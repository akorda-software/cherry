defmodule Snack.NotificationsTest do
  use Snack.DataCase, async: true
  use Oban.Testing, repo: Snack.Repo

  import Snack.TestSupport.DatingFixtures

  alias Snack.Dating
  alias Snack.Dating.Conversation
  alias Snack.Notifications
  alias Snack.Notifications.PushWorker
  alias Snack.Repo
  alias Snack.Sessions
  alias Snack.Sessions.PushToken

  setup do
    Process.put(:expo_push_test_pid, self())
    :ok
  end

  describe "deliver_to_profile/2" do
    test "deactivates tokens rejected by Expo as DeviceNotRegistered" do
      user = user_fixture()
      profile = profile_fixture(user)

      push_token =
        register_push_token(user, "ExponentPushToken[DeviceNotRegistered]", "install-invalid")

      assert {:ok, %{sent: 0, invalidated: 1}} =
               Notifications.deliver_to_profile(profile, %{
                 "title" => "Test",
                 "body" => "Test",
                 "data" => %{"type" => "test"}
               })

      assert_receive {:expo_push_messages, [%{"to" => "ExponentPushToken[DeviceNotRegistered]"}]}
      assert Repo.get!(PushToken, push_token.id).status == "inactive"
      assert Repo.get!(PushToken, push_token.id).disabled_at != nil
    end
  end

  describe "product notification triggers" do
    test "record_swipe/1 queues independent new_match jobs without calling Expo" do
      user_a = user_fixture(%{display_name: "Ana"})
      user_b = user_fixture(%{display_name: "Ben"})
      profile_a = profile_fixture(user_a, %{display_name: "Ana"})
      profile_b = profile_fixture(user_b, %{display_name: "Ben"})

      register_push_token(user_a, "ExponentPushToken[token-a]", "install-a")
      register_push_token(user_b, "ExponentPushToken[token-b]", "install-b")

      assert {:ok, %{match: nil}} =
               Dating.record_swipe(%{
                 actor_profile_id: profile_b.id,
                 target_profile_id: profile_a.id,
                 action_type: "like"
               })

      refute_receive {:expo_push_messages, _messages}

      assert {:ok, %{match: match}} =
               Dating.record_swipe(%{
                 actor_profile_id: profile_a.id,
                 target_profile_id: profile_b.id,
                 action_type: "like"
               })

      refute_receive {:expo_push_messages, _messages}

      assert_enqueued(
        worker: PushWorker,
        args: %{event: "new_match", entity_id: match.id, recipient_profile_id: profile_a.id}
      )

      assert_enqueued(
        worker: PushWorker,
        args: %{event: "new_match", entity_id: match.id, recipient_profile_id: profile_b.id}
      )

      assert %{success: 2} = Oban.drain_queue(queue: :push)

      assert_receive {:expo_push_messages, [message_a]}
      assert_receive {:expo_push_messages, [message_b]}

      messages = [message_a, message_b]

      assert Enum.map(messages, & &1["to"]) |> Enum.sort() ==
               ["ExponentPushToken[token-a]", "ExponentPushToken[token-b]"]

      assert Enum.all?(messages, &(get_in(&1, ["data", "type"]) == "new_match"))
      assert Enum.all?(messages, &(get_in(&1, ["data", "matchId"]) == match.id))

      conversation = Repo.get_by!(Conversation, match_id: match.id)
      assert Enum.all?(messages, &(get_in(&1, ["data", "conversationId"]) == conversation.id))

      assert messages |> Enum.map(& &1["title"]) |> Enum.sort() ==
               ["¡Match con Ana! 💘", "¡Match con Ben! 💘"]

      assert Enum.all?(
               messages,
               &(&1["body"] == "Os habéis gustado. Rompe el hielo cuando te apetezca 👋")
             )
    end

    test "send_message/1 queues a new_message notification only to the recipient" do
      user_a = user_fixture(%{display_name: "Ana"})
      user_b = user_fixture(%{display_name: "Ben"})
      profile_a = profile_fixture(user_a, %{display_name: "Ana"})
      profile_b = profile_fixture(user_b, %{display_name: "Ben"})

      {:ok, %{match: nil}} =
        Dating.record_swipe(%{
          actor_profile_id: profile_b.id,
          target_profile_id: profile_a.id,
          action_type: "like"
        })

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: profile_a.id,
          target_profile_id: profile_b.id,
          action_type: "like"
        })

      register_push_token(user_a, "ExponentPushToken[token-sender]", "install-sender")
      register_push_token(user_b, "ExponentPushToken[token-recipient]", "install-recipient")

      conversation = Repo.get_by!(Conversation, match_id: match.id)

      assert {:ok, message} =
               Dating.send_message(%{
                 conversation_id: conversation.id,
                 sender_profile_id: profile_a.id,
                 body: "Hola, que tal?"
               })

      refute_receive {:expo_push_messages, _messages}

      assert_enqueued(
        worker: PushWorker,
        args: %{event: "new_message", entity_id: message.id, recipient_profile_id: profile_b.id}
      )

      assert %{success: 1} = Oban.drain_queue(queue: :push)

      assert_receive {:expo_push_messages, [push]}
      assert push["to"] == "ExponentPushToken[token-recipient]"
      assert push["title"] == "Ana te ha escrito"
      assert push["body"] == "Tienes un mensaje nuevo esperándote 💬"

      assert push["data"] == %{
               "type" => "new_message",
               "conversationId" => conversation.id,
               "messageId" => message.id,
               "senderProfileId" => profile_a.id
             }

      refute_receive {:expo_push_messages, _messages}
    end
  end

  describe "outbox reliability" do
    setup do
      sender = profile_fixture(user_fixture())
      user = user_fixture()
      recipient = profile_fixture(user)

      {:ok, %{match: nil}} =
        Dating.record_swipe(%{
          actor_profile_id: sender.id,
          target_profile_id: recipient.id,
          action_type: "like"
        })

      {:ok, %{match: match}} =
        Dating.record_swipe(%{
          actor_profile_id: recipient.id,
          target_profile_id: sender.id,
          action_type: "like"
        })

      conversation = Repo.get_by!(Conversation, match_id: match.id)
      token = register_push_token(user, "ExponentPushToken[outbox]", "outbox-install")
      %{sender: sender, recipient: recipient, conversation: conversation, token: token}
    end

    test "a rolled-back message leaves no push job", context do
      assert {:error, :abort} =
               Repo.transaction(fn ->
                 assert {:ok, _message} = send_message(context)
                 Repo.rollback(:abort)
               end)

      refute_enqueued(worker: PushWorker)
      refute_receive {:expo_push_messages, _}
    end

    test "delivery retries a transport failure independently of the committed message", context do
      assert {:ok, message} = send_message(context)
      Process.put(:expo_push_test_result, {:error, :provider_unavailable})
      assert %{failure: 1} = Oban.drain_queue(queue: :push)
      assert Repo.get!(Snack.Dating.Message, message.id).body == "Outbox test"
      Process.delete(:expo_push_test_result)
      assert %{success: 1} = Oban.drain_queue(queue: :push, with_scheduled: true)
    end

    test "a committed block cancels a queued message push", context do
      assert {:ok, _} = send_message(context)

      assert {:ok, _} =
               Dating.block_profile(%{
                 actor_profile_id: context.recipient.id,
                 target_profile_id: context.sender.id
               })

      assert %{cancelled: 1} = Oban.drain_queue(queue: :push)
      refute_receive {:expo_push_messages, _}
    end

    test "reading a message before delivery suppresses its push", context do
      assert {:ok, message} = send_message(context)

      assert {:ok, _} =
               Snack.Dating.Inbox.mark_read(
                 context.conversation.id,
                 context.recipient.id,
                 message.inserted_at
               )

      assert %{cancelled: 1} = Oban.drain_queue(queue: :push)
      refute_receive {:expo_push_messages, _}
    end

    test "revoked sessions are rechecked at delivery time", context do
      assert {:ok, _} = send_message(context)
      assert :ok = Sessions.revoke_user_sessions(context.recipient.user_id)
      assert %{success: 1} = Oban.drain_queue(queue: :push)
      refute_receive {:expo_push_messages, _}
    end

    test "queued payloads contain no plaintext message", context do
      assert {:ok, message} = send_message(context)
      [job] = all_enqueued(worker: PushWorker)

      assert job.args == %{
               "event" => "new_message",
               "entity_id" => message.id,
               "recipient_profile_id" => context.recipient.id
             }
    end

    defp send_message(context) do
      Dating.send_message(%{
        conversation_id: context.conversation.id,
        sender_profile_id: context.sender.id,
        body: "Outbox test"
      })
    end
  end

  defp register_push_token(user, expo_push_token, installation_id) do
    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: installation_id,
        platform: "ios",
        device_name: "Test Device"
      })

    {:ok, push_token} =
      Sessions.register_push_token(user, issued.session_family.id, %{
        "expoPushToken" => expo_push_token,
        "platform" => "ios",
        "installationId" => installation_id
      })

    push_token
  end
end
