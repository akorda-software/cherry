defmodule SnackWeb.ChatChannelReadTest do
  use SnackWeb.ChannelCase, async: false

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating.ConversationRead
  alias Snack.Dating.Inbox
  alias Snack.Repo
  alias Snack.Sessions
  alias SnackWeb.UserSocket

  test "sending through the socket marks the conversation as read for the sender" do
    user_a = user_fixture()
    user_b = user_fixture()
    profile_a = complete_profile_fixture(user_a)
    profile_b = complete_profile_fixture(user_b)
    {_match, conversation} = mutual_match!(profile_a, profile_b)
    insert_message!(conversation, profile_b, "¿Hola?", seconds_ago(10))

    assert %{unread_conversations_count: 1} = Inbox.counts(profile_a.id)

    {:ok, issued} =
      Sessions.issue_session(user_a, %{
        installation_id: "read-socket",
        platform: "ios",
        device_name: "Test Device"
      })

    {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{issued.session.access_token}"})
    {:ok, _, socket} = join(socket, "chat:#{conversation.id}")

    ref = push(socket, "send_message", %{"body" => "¡Hola! 👋"})
    assert_reply ref, :ok, %{message: %{body: "¡Hola! 👋"}}
    assert_receive %Phoenix.Socket.Message{event: "new_message"}
    # Broadcast once, from the common send path (not again by the channel).
    refute_receive %Phoenix.Socket.Message{event: "new_message"}

    assert Repo.get_by(ConversationRead,
             conversation_id: conversation.id,
             profile_id: profile_a.id
           )

    assert %{unread_conversations_count: 0, new_matches_count: 0} = Inbox.counts(profile_a.id)
    assert %{unread_conversations_count: 1} = Inbox.counts(profile_b.id)
  end
end
