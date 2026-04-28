defmodule SnackWeb.ChatChannelTest do
  use SnackWeb.ChannelCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Repo
  alias Snack.Sessions
  alias SnackWeb.UserSocket

  setup do
    # Create two users with complete profiles
    {:ok, user_a} = Accounts.create_user(%{email: "chatter_a@example.com", display_name: "Chatter A"})
    {:ok, user_b} = Accounts.create_user(%{email: "chatter_b@example.com", display_name: "Chatter B"})

    profile_a = create_complete_profile(user_a)
    profile_b = create_complete_profile(user_b)

    # Create a match and conversation
    {:ok, _} = Dating.record_swipe(%{actor_profile_id: profile_a.id, target_profile_id: profile_b.id, action_type: "like"})
    {:ok, result} = Dating.record_swipe(%{actor_profile_id: profile_b.id, target_profile_id: profile_a.id, action_type: "like"})

    match = result.match |> Repo.preload(:conversation)
    conversation = match.conversation

    # Issue tokens for sockets
    {:ok, issued_a} =
      Sessions.issue_session(user_a, %{
        installation_id: "socket-a",
        platform: "ios",
        device_name: "Test Device"
      })

    {:ok, issued_b} =
      Sessions.issue_session(user_b, %{
        installation_id: "socket-b",
        platform: "ios",
        device_name: "Test Device"
      })

    %{
      profile_a: profile_a,
      profile_b: profile_b,
      match: match,
      conversation: conversation,
      token_a: issued_a.session.access_token,
      token_b: issued_b.session.access_token
    }
  end

  describe "join chat:conversation_id" do
    test "allows participant to join", %{conversation: conversation, token_a: token} do
      {:ok, _, socket} = connect_and_join(token, conversation.id)
      assert socket.assigns.conversation_id == conversation.id
    end

    test "rejects non-participant", %{conversation: conversation} do
      # Create a third user who is not part of the conversation
      {:ok, user_c} = Accounts.create_user(%{email: "chatter_c@example.com", display_name: "Chatter C"})
      _profile_c = create_complete_profile(user_c)

      {:ok, issued_c} =
        Sessions.issue_session(user_c, %{
          installation_id: "socket-c",
          platform: "ios",
          device_name: "Test Device"
        })

      {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{issued_c.session.access_token}"})
      assert {:error, %{reason: "not_participant"}} = join(socket, "chat:#{conversation.id}")
    end
  end

  describe "send_message event" do
    test "broadcasts message to other participant", %{
      conversation: conversation,
      token_a: token_a,
      token_b: token_b
    } do
      {:ok, _, socket_a} = connect_and_join(token_a, conversation.id)
      {:ok, _, _socket_b} = connect_and_join(token_b, conversation.id)

      ref = push(socket_a, "send_message", %{"body" => "Hello from A"})
      assert_reply ref, :ok, %{message: %{body: "Hello from A"}}

      assert_receive %Phoenix.Socket.Message{event: "new_message", payload: %{body: "Hello from A"}}
    end

    test "persists message in database", %{
      conversation: conversation,
      token_a: token_a,
      profile_a: profile_a
    } do
      {:ok, _, socket} = connect_and_join(token_a, conversation.id)

      ref = push(socket, "send_message", %{"body" => "Persisted message"})
      assert_reply ref, :ok, _

      msgs = Dating.list_messages(conversation.id)
      assert Enum.any?(msgs, & &1.body == "Persisted message")
      assert Enum.any?(msgs, & &1.sender_profile_id == profile_a.id)
    end

    test "rejects empty message", %{
      conversation: conversation,
      token_a: token_a
    } do
      {:ok, _, socket} = connect_and_join(token_a, conversation.id)

      ref = push(socket, "send_message", %{"body" => ""})
      assert_reply ref, :error, %{errors: %{body: ["can't be blank"]}}
    end
  end

  describe "typing event" do
    test "broadcasts typing indicator to other participant", %{
      conversation: conversation,
      token_a: token_a,
      token_b: token_b
    } do
      {:ok, _, socket_a} = connect_and_join(token_a, conversation.id)
      {:ok, _, _socket_b} = connect_and_join(token_b, conversation.id)

      push(socket_a, "typing", %{"is_typing" => true})
      assert_receive %Phoenix.Socket.Message{event: "typing", payload: %{profile_id: _}}
    end
  end

  defp connect_and_join(token, conversation_id) do
    {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{token}"})
    join(socket, "chat:#{conversation_id}")
  end

  defp create_complete_profile(user) do
    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Test",
        birth_date: ~D[1995-01-15],
        gender: "man",
        what_i_am_looking_for: "relationship",
        bio: "This is a test bio that is long enough to pass validation rules.",
        is_discoverable: true
      })

    Dating.upsert_discovery_preference(profile.id, %{
      age_min: 18,
      age_max: 50,
      distance_km: 100,
      show_men: true,
      show_women: true,
      show_non_binary: false
    })

    Dating.upsert_location(%{
      profile_id: profile.id,
      coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
      recorded_at: DateTime.utc_now()
    })

    for i <- 1..2 do
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "photo#{i}",
        url: "https://example.com/photo#{i}.jpg",
        position: i,
        is_active: true
      })
    end

    tags = Dating.list_active_tags() |> Enum.take(2)
    Dating.set_profile_tags(profile.id, Enum.map(tags, & &1.id))

    Dating.set_profile_complete(profile)
    Repo.get!(Dating.Profile, profile.id)
  end
end
