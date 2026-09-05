defmodule SnackWeb.ChatChannelTest do
  use SnackWeb.ChannelCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Repo
  alias Snack.Sessions
  alias SnackWeb.UserSocket

  setup do
    # Create two users with complete profiles
    {:ok, user_a} =
      Accounts.create_user(%{email: "chatter_a@example.com", display_name: "Chatter A"})

    {:ok, user_b} =
      Accounts.create_user(%{email: "chatter_b@example.com", display_name: "Chatter B"})

    profile_a = create_complete_profile(user_a)
    profile_b = create_complete_profile(user_b)

    # Create a match and conversation
    {:ok, _} =
      Dating.record_swipe(%{
        actor_profile_id: profile_a.id,
        target_profile_id: profile_b.id,
        action_type: "like"
      })

    {:ok, result} =
      Dating.record_swipe(%{
        actor_profile_id: profile_b.id,
        target_profile_id: profile_a.id,
        action_type: "like"
      })

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

    test "rejects inactive conversations", %{
      conversation: conversation,
      match: match,
      token_a: token
    } do
      match
      |> Ecto.Changeset.change(status: "unmatched", unmatched_at: now())
      |> Repo.update!()

      {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{token}"})

      assert {:error, %{reason: "conversation_not_active"}} =
               join(socket, "chat:#{conversation.id}")
    end

    test "rejects expired conversations", %{
      conversation: conversation,
      match: match,
      token_a: token
    } do
      match
      |> Ecto.Changeset.change(expires_at: DateTime.add(now(), -1, :day))
      |> Repo.update!()

      {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{token}"})

      assert {:error, %{reason: "conversation_not_active"}} =
               join(socket, "chat:#{conversation.id}")
    end

    test "rejects non-participant", %{conversation: conversation} do
      # Create a third user who is not part of the conversation
      {:ok, user_c} =
        Accounts.create_user(%{email: "chatter_c@example.com", display_name: "Chatter C"})

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
    test "an existing socket cannot send or type after either participant blocks", ctx do
      {:ok, _, socket_a} = connect_and_join(ctx.token_a, ctx.conversation.id)
      {:ok, _, socket_b} = connect_and_join(ctx.token_b, ctx.conversation.id)

      {:ok, _} =
        Dating.block_profile(%{
          actor_profile_id: ctx.profile_a.id,
          target_profile_id: ctx.profile_b.id
        })

      for socket <- [socket_a, socket_b] do
        ref = push(socket, "send_message", %{"body" => "Blocked"})
        assert_reply ref, :error, %{reason: "conversation_not_active"}
        push(socket, "typing", %{})
      end

      refute_receive %Phoenix.Socket.Message{event: "typing"}
      assert Dating.list_messages(ctx.conversation.id) == []

      assert {:error, %{reason: "conversation_not_active"}} =
               connect_and_join(ctx.token_b, ctx.conversation.id)
    end

    test "queued broadcasts are not delivered after a block", ctx do
      {:ok, _, _socket} = connect_and_join(ctx.token_a, ctx.conversation.id)

      {:ok, _} =
        Dating.block_profile(%{
          actor_profile_id: ctx.profile_a.id,
          target_profile_id: ctx.profile_b.id
        })

      SnackWeb.Endpoint.broadcast("chat:#{ctx.conversation.id}", "new_message", %{
        body: "In flight"
      })

      refute_receive %Phoenix.Socket.Message{event: "new_message"}
    end

    test "broadcasts message to other participant", %{
      conversation: conversation,
      token_a: token_a,
      token_b: token_b
    } do
      {:ok, _, socket_a} = connect_and_join(token_a, conversation.id)
      {:ok, _, _socket_b} = connect_and_join(token_b, conversation.id)

      ref = push(socket_a, "send_message", %{"body" => "Hello from A"})

      assert_reply ref, :ok, %{
        message: %{
          conversationId: conversation_id,
          senderProfileId: sender_profile_id,
          body: "Hello from A",
          insertedAt: %DateTime{}
        }
      }

      assert conversation_id == conversation.id
      assert is_binary(sender_profile_id)

      assert_receive %Phoenix.Socket.Message{
        event: "new_message",
        payload: %{
          conversationId: ^conversation_id,
          senderProfileId: ^sender_profile_id,
          body: "Hello from A",
          insertedAt: %DateTime{}
        }
      }

      # Both joined sockets receive the broadcast; drain both before sandbox teardown.
      assert_receive %Phoenix.Socket.Message{event: "new_message"}
    end

    test "persists message in database", %{
      conversation: conversation,
      token_a: token_a,
      profile_a: profile_a
    } do
      {:ok, _, socket} = connect_and_join(token_a, conversation.id)

      ref = push(socket, "send_message", %{"body" => "Persisted message"})
      assert_reply ref, :ok, _
      assert_receive %Phoenix.Socket.Message{event: "new_message"}

      msgs = Dating.list_messages(conversation.id)
      assert Enum.any?(msgs, &(&1.body == "Persisted message"))
      assert Enum.any?(msgs, &(&1.sender_profile_id == profile_a.id))
    end

    test "rejects empty message", %{
      conversation: conversation,
      token_a: token_a
    } do
      {:ok, _, socket} = connect_and_join(token_a, conversation.id)

      ref = push(socket, "send_message", %{"body" => ""})
      assert_reply ref, :error, %{errors: %{body: ["can't be blank"]}}
    end

    test "rejects sends after conversation becomes inactive", %{
      conversation: conversation,
      match: match,
      token_a: token_a
    } do
      {:ok, _, socket} = connect_and_join(token_a, conversation.id)

      match
      |> Ecto.Changeset.change(status: "unmatched", unmatched_at: now())
      |> Repo.update!()

      ref = push(socket, "send_message", %{"body" => "Should not send"})
      assert_reply ref, :error, %{reason: "conversation_not_active"}
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

      assert_receive %Phoenix.Socket.Message{
        event: "typing",
        payload: %{conversationId: conversation_id, profileId: profile_id}
      }

      assert conversation_id == conversation.id
      assert is_binary(profile_id)
    end
  end

  defp connect_and_join(token, conversation_id) do
    {:ok, socket} = connect(UserSocket, %{"token" => "Bearer #{token}"})
    join(socket, "chat:#{conversation_id}")
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)

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

    tags = for i <- 1..2, do: tag_fixture("chat-#{profile.id}-#{i}")
    Dating.set_profile_tags(profile.id, Enum.map(tags, & &1.id))

    Dating.set_profile_complete(profile)
    Repo.get!(Dating.Profile, profile.id)
  end

  defp tag_fixture(slug) do
    {:ok, tag} =
      Dating.create_tag(%{
        slug: slug,
        label: "Chat Tag",
        category: "test"
      })

    tag
  end
end
