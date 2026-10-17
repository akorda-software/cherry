defmodule CherryWeb.Controllers.Api.DatingRegressionTest do
  use CherryWeb.ConnCase, async: false

  import Cherry.TestSupport.DatingFixtures

  alias Cherry.{Dating, Repo, Sessions}

  setup do
    user = user_fixture()
    other_user = user_fixture()
    profile = complete_profile_fixture(user)
    other = complete_profile_fixture(other_user)

    {:ok, _} =
      Dating.record_swipe(%{
        actor_profile_id: profile.id,
        target_profile_id: other.id,
        action_type: "like"
      })

    {:ok, %{match: match}} =
      Dating.record_swipe(%{
        actor_profile_id: other.id,
        target_profile_id: profile.id,
        action_type: "like"
      })

    conversation = Repo.preload(match, :conversation).conversation

    %{
      user: user,
      profile: profile,
      other: other,
      conversation: conversation,
      authed_conn: authed_conn_for_user(user),
      other_conn: authed_conn_for_user(other_user)
    }
  end

  test "REST history returns persisted messages and denies outsiders", ctx do
    {:ok, message} =
      Dating.send_message(%{
        conversation_id: ctx.conversation.id,
        sender_profile_id: ctx.profile.id,
        body: "Hola"
      })

    path = "/api/conversations/#{ctx.conversation.id}/messages"

    assert %{"messages" => [%{"id" => id, "body" => "Hola"}]} =
             ctx.authed_conn |> get(path) |> json_response(200)

    assert id == message.id

    outsider = user_fixture()
    profile_fixture(outsider)

    assert %{"error" => "not_participant"} =
             outsider |> authed_conn_for_user() |> get(path) |> json_response(403)
  end

  test "blocking stops REST messages in both directions", ctx do
    assert %{"ok" => true} =
             ctx.authed_conn |> post("/api/users/#{ctx.other.id}/block") |> json_response(200)

    path = "/api/conversations/#{ctx.conversation.id}/messages"

    for conn <- [ctx.authed_conn, ctx.other_conn] do
      assert %{"error" => "conversation_not_active"} =
               conn |> post(path, %{"body" => "Should not send"}) |> json_response(403)
    end

    assert Dating.list_messages(ctx.conversation.id) == []
  end

  test "chat history validates pagination input", ctx do
    path = "/api/conversations/#{ctx.conversation.id}/messages"

    for params <- [
          %{"limit" => "abc"},
          %{"limit" => "-1"},
          %{"limit" => "1000000"},
          %{"cursor" => "bad"}
        ] do
      assert ctx.authed_conn |> get(path, params) |> response(422)
    end
  end

  test "deleting an account revokes every device and prevents new sessions", ctx do
    {:ok, issued} =
      Sessions.issue_session(ctx.user, %{
        installation_id: "second-device",
        platform: "ios",
        device_name: "Second"
      })

    :ok = Phoenix.PubSub.subscribe(Cherry.PubSub, "user_socket:#{ctx.user.id}")

    {:ok, push_token} =
      Sessions.register_push_token(ctx.user, issued.session_family.id, %{
        installation_id: "second-device",
        platform: "ios",
        expo_push_token: "ExponentPushToken[deleted-account]"
      })

    assert %{"ok" => true} = ctx.authed_conn |> delete("/api/me/account") |> json_response(200)
    assert ctx.authed_conn |> get("/api/me/profile") |> response(401)
    assert {:error, _} = CherryWeb.TokenAuth.authenticate(issued.session.access_token)
    assert {:error, _} = Sessions.refresh_session(issued.session.refresh_token)
    refute Repo.get(Cherry.Sessions.PushToken, push_token.id)

    assert {:error, :account_deleted} =
             Sessions.issue_session(ctx.user, %{
               installation_id: "new-device",
               platform: "ios",
               device_name: "New"
             })

    assert_receive %Phoenix.Socket.Broadcast{event: "disconnect"}

    assert %{"error" => "not_participant"} =
             ctx.other_conn
             |> post("/api/conversations/#{ctx.conversation.id}/messages", %{
               "body" => "After deletion"
             })
             |> json_response(403)

    refute Repo.get(Dating.Profile, ctx.profile.id)
  end

  test "a user can delete their account before creating a profile" do
    user = user_fixture()
    conn = authed_conn_for_user(user)
    assert %{"ok" => true} = conn |> delete("/api/me/account") |> json_response(200)
    assert conn |> get("/api/bootstrap") |> response(401)
  end

  test "resuming a complete profile restores discovery", ctx do
    ctx.authed_conn |> post("/api/me/pause") |> json_response(200)
    ctx.authed_conn |> post("/api/me/unpause") |> json_response(200)
    profile = Repo.get!(Dating.Profile, ctx.profile.id)
    refute profile.is_paused
    assert profile.is_discoverable
  end
end
