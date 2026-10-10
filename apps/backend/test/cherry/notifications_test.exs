defmodule Cherry.NotificationsTest do
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Dating
  alias Cherry.Dating.Conversation
  alias Cherry.Notifications
  alias Cherry.Repo
  alias Cherry.Sessions
  alias Cherry.Sessions.PushToken

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
    test "record_swipe/1 sends new_match notifications to both matched profiles" do
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

      assert_receive {:expo_push_messages, [message_a]}
      assert_receive {:expo_push_messages, [message_b]}

      messages = [message_a, message_b]

      assert Enum.map(messages, & &1["to"]) |> Enum.sort() ==
               ["ExponentPushToken[token-a]", "ExponentPushToken[token-b]"]

      assert Enum.all?(messages, &(get_in(&1, ["data", "type"]) == "new_match"))
      assert Enum.all?(messages, &(get_in(&1, ["data", "matchId"]) == match.id))
    end

    test "send_message/1 sends a new_message notification only to the recipient" do
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

      assert_receive {:expo_push_messages, [push]}
      assert push["to"] == "ExponentPushToken[token-recipient]"
      assert push["title"] == "Nuevo mensaje de Ana"
      assert push["body"] == "Tienes un mensaje nuevo."

      assert push["data"] == %{
               "type" => "new_message",
               "conversationId" => conversation.id,
               "messageId" => message.id,
               "senderProfileId" => profile_a.id
             }

      refute_receive {:expo_push_messages, _messages}
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
