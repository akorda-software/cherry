defmodule Snack.MessagingEfficiencyTest do
  use Snack.DataCase, async: true
  use Oban.Testing, repo: Snack.Repo

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating
  alias Snack.Dating.{Conversation, Match}

  describe "transactional broadcasts" do
    setup do
      sender = profile_fixture(user_fixture())
      recipient = profile_fixture(user_fixture())
      {_match, conversation} = mutual_match!(sender, recipient)
      SnackWeb.Endpoint.subscribe("chat:#{conversation.id}")
      %{sender: sender, conversation: conversation}
    end

    test "a caller rollback cannot publish a nonexistent message", ctx do
      assert {:error, :abort} =
               Repo.transaction(fn ->
                 assert {:ok, _} =
                          Dating.send_message(%{
                            conversation_id: ctx.conversation.id,
                            sender_profile_id: ctx.sender.id,
                            body: "Rolled back"
                          })

                 Repo.rollback(:abort)
               end)

      refute_enqueued(worker: Snack.Dating.ChatBroadcastWorker)
      refute_receive %Phoenix.Socket.Broadcast{event: "new_message"}
      assert Dating.list_messages(ctx.conversation.id) == []
    end

    test "a committed caller transaction broadcasts its persisted message asynchronously", ctx do
      assert {:ok, message} =
               Repo.transaction(fn ->
                 assert {:ok, message} =
                          Dating.send_message(%{
                            conversation_id: ctx.conversation.id,
                            sender_profile_id: ctx.sender.id,
                            body: "Committed"
                          })

                 refute_receive %Phoenix.Socket.Broadcast{event: "new_message"}
                 message
               end)

      assert_enqueued(worker: Snack.Dating.ChatBroadcastWorker, args: %{message_id: message.id})
      assert %{success: 1} = Oban.drain_queue(queue: :push)

      assert_receive %Phoenix.Socket.Broadcast{
        event: "new_message",
        payload: %{id: id, body: "Committed"}
      }

      assert id == message.id
    end
  end

  test "chat authorization checks participation, account state and blocks in one query" do
    a = profile_fixture(user_fixture())
    b = profile_fixture(user_fixture())

    {:ok, match} =
      %Match{}
      |> Match.changeset(%{
        profile_a_id: a.id,
        profile_b_id: b.id,
        matched_at: DateTime.utc_now()
      })
      |> Repo.insert()

    {:ok, conversation} =
      %Conversation{} |> Conversation.changeset(%{match_id: match.id}) |> Repo.insert()

    handler_id = {__MODULE__, self()}

    :ok =
      :telemetry.attach(handler_id, [:snack, :repo, :query], &__MODULE__.count_query/4, self())

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert {:ok, authorized} = Dating.get_messageable_conversation(conversation.id, a.id)
    assert authorized.match.id == match.id
    assert_receive :authorization_query
    refute_receive :authorization_query
  end

  def count_query(_event, _measurements, _metadata, owner) do
    if self() == owner, do: send(owner, :authorization_query)
  end
end
