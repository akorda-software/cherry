defmodule Cherry.Dating.MessagePagesTest do
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating.{Inbox, Message}

  test "invalid or unbounded page sizes return invalid_limit before querying" do
    handler = {__MODULE__, self()}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, self())

    try do
      for limit <- [0, -1, 101, 1_000_000, nil, "10", 1.5] do
        assert {:error, :invalid_limit} =
                 Inbox.list_messages_page(Ecto.UUID.generate(), limit: limit)
      end

      refute_received :message_page_query
    after
      :telemetry.detach(handler)
    end
  end

  test "composite cursors preserve every message when timestamps tie exactly" do
    sender = profile_fixture(user_fixture())
    recipient = profile_fixture(user_fixture())
    {_match, conversation} = mutual_match!(sender, recipient)
    at = ~U[2026-10-01 12:00:00.123456Z]

    ids =
      for i <- 1..7 do
        %Message{}
        |> Ecto.Changeset.change(%{
          conversation_id: conversation.id,
          sender_profile_id: sender.id,
          body: "Message #{i}",
          inserted_at: at,
          updated_at: at
        })
        |> Repo.insert!()
        |> Map.fetch!(:id)
      end

    {:ok, first} = Inbox.list_messages_page(conversation.id, limit: 3)
    {:ok, second} = Inbox.list_messages_page(conversation.id, limit: 3, cursor: first.next_cursor)
    {:ok, third} = Inbox.list_messages_page(conversation.id, limit: 3, cursor: second.next_cursor)

    assert Enum.map(first.messages ++ second.messages ++ third.messages, & &1.id) ==
             Enum.sort(ids, :desc)

    assert third.next_cursor == nil
  end

  def query(_event, _measurements, _metadata, owner) do
    if self() == owner, do: send(owner, :message_page_query)
  end
end
