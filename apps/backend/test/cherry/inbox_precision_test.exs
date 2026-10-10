defmodule Cherry.Dating.InboxPrecisionTest do
  @moduledoc """
  Mensajes y marcas de lectura con microsegundos (migración
  20260929170000_message_timestamps_usec).
  """
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating
  alias Cherry.Dating.Inbox

  setup do
    a = complete_profile_fixture(user_fixture(), %{display_name: "Ana"})
    b = complete_profile_fixture(user_fixture(), %{display_name: "Bea"})
    {match, conversation} = mutual_match!(a, b)
    %{a: a, b: b, match: match, conversation: conversation}
  end

  defp send!(conversation, sender, body) do
    {:ok, message} =
      Dating.send_message(%{
        conversation_id: conversation.id,
        sender_profile_id: sender.id,
        body: body
      })

    message
  end

  test "messages sent within the same second keep their send order", ctx do
    bodies = for i <- 1..8, do: "mensaje #{i}"
    Enum.each(bodies, &send!(ctx.conversation, ctx.a, &1))

    {:ok, %{messages: page}} = Inbox.list_messages_page(ctx.conversation.id, limit: 50)

    assert Enum.map(page, & &1.body) == Enum.reverse(bodies)
    assert Enum.all?(page, &match?(%DateTime{microsecond: {_, 6}}, &1.inserted_at))
  end

  test "the opaque cursor pages through same-second messages without gaps or repeats", ctx do
    bodies = for i <- 1..7, do: "m#{i}"
    Enum.each(bodies, &send!(ctx.conversation, ctx.b, &1))

    {:ok, first} = Inbox.list_messages_page(ctx.conversation.id, limit: 3)

    {:ok, second} =
      Inbox.list_messages_page(ctx.conversation.id, limit: 3, cursor: first.next_cursor)

    {:ok, third} =
      Inbox.list_messages_page(ctx.conversation.id, limit: 3, cursor: second.next_cursor)

    seen = Enum.map(first.messages ++ second.messages ++ third.messages, & &1.body)
    assert seen == Enum.reverse(bodies)
    assert third.next_cursor == nil
  end

  test "legacy second-precision cursors (m1:) are still accepted", ctx do
    message = send!(ctx.conversation, ctx.a, "hola")
    later = DateTime.add(message.inserted_at, 5, :second)

    legacy =
      Base.url_encode64("m1:#{DateTime.to_unix(later)}:#{Ecto.UUID.generate()}", padding: false)

    assert {:ok, %{messages: [%{body: "hola"}]}} =
             Inbox.list_messages_page(ctx.conversation.id, cursor: legacy)
  end

  test "a message that arrives after reading, within the same second, stays unread", ctx do
    send!(ctx.conversation, ctx.b, "primero")
    {:ok, _read} = Inbox.mark_read(ctx.conversation.id, ctx.a.id)
    Process.sleep(2)
    send!(ctx.conversation, ctx.b, "segundo")

    assert %{unread_conversations_count: 1} = Inbox.counts(ctx.a.id)

    {:ok, _read} = Inbox.mark_read(ctx.conversation.id, ctx.a.id)
    assert %{unread_conversations_count: 0} = Inbox.counts(ctx.a.id)
  end

  test "JSON timestamps carry milliseconds, never microseconds", ctx do
    message = send!(ctx.conversation, ctx.a, "hola")
    %{insertedAt: inserted_at} = CherryWeb.ChatJSON.message(message)

    assert {_value, 3} = inserted_at.microsecond
    assert DateTime.to_iso8601(inserted_at) =~ ~r/\.\d{3}Z$/
  end
end
