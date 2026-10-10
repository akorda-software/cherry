defmodule CherryWeb.Controllers.Api.PushTokenControllerTest do
  use CherryWeb.ConnCase, async: false

  alias Cherry.Accounts
  alias Cherry.Repo
  alias Cherry.Sessions
  alias Cherry.Sessions.PushToken

  describe "POST /api/me/push-token" do
    test "registers an Expo push token for the current session device" do
      %{conn: conn, user: user} = authed_conn(%{installation_id: "install-a", platform: "ios"})

      conn =
        post(conn, "/api/me/push-token", %{
          "expoPushToken" => "ExponentPushToken[token-a]",
          "platform" => "ios",
          "installationId" => "install-a"
        })

      assert %{
               "ok" => true,
               "pushToken" => %{
                 "id" => id,
                 "platform" => "ios",
                 "installationId" => "install-a",
                 "status" => "active"
               }
             } = json_response(conn, 200)

      push_token = Repo.get!(PushToken, id)
      assert push_token.user_id == user.id
      assert push_token.expo_push_token == "ExponentPushToken[token-a]"
      assert push_token.status == "active"
    end

    test "updates the token for the same session family" do
      %{conn: conn} = authed_conn(%{installation_id: "install-b", platform: "android"})

      post(conn, "/api/me/push-token", %{
        "expoPushToken" => "ExpoPushToken[token-b-1]",
        "platform" => "android",
        "installationId" => "install-b"
      })

      conn =
        post(conn, "/api/me/push-token", %{
          "expoPushToken" => "ExpoPushToken[token-b-2]",
          "platform" => "android",
          "installationId" => "install-b"
        })

      assert %{"ok" => true} = json_response(conn, 200)
      assert Repo.aggregate(PushToken, :count, :id) == 1
      assert Repo.one!(PushToken).expo_push_token == "ExpoPushToken[token-b-2]"
    end

    test "deactivates duplicate active tokens from older sessions" do
      %{conn: old_conn} = authed_conn(%{installation_id: "install-c", platform: "ios"})
      %{conn: new_conn} = authed_conn(%{installation_id: "install-c", platform: "ios"})

      post(old_conn, "/api/me/push-token", %{
        "expoPushToken" => "ExponentPushToken[token-c]",
        "platform" => "ios",
        "installationId" => "install-c"
      })

      post(new_conn, "/api/me/push-token", %{
        "expoPushToken" => "ExponentPushToken[token-c]",
        "platform" => "ios",
        "installationId" => "install-c"
      })

      statuses = PushToken |> Repo.all() |> Enum.map(& &1.status) |> Enum.sort()
      assert statuses == ["active", "inactive"]
    end

    test "rejects device mismatch" do
      %{conn: conn} = authed_conn(%{installation_id: "install-d", platform: "ios"})

      conn =
        post(conn, "/api/me/push-token", %{
          "expoPushToken" => "ExponentPushToken[token-d]",
          "platform" => "ios",
          "installationId" => "other-install"
        })

      assert %{"error" => "device_mismatch"} = json_response(conn, 422)
    end

    test "rejects invalid Expo token format" do
      %{conn: conn} = authed_conn(%{installation_id: "install-e", platform: "ios"})

      conn =
        post(conn, "/api/me/push-token", %{
          "expoPushToken" => "not-an-expo-token",
          "platform" => "ios",
          "installationId" => "install-e"
        })

      assert conn.status == 422

      assert %{"errors" => %{"expo_push_token" => ["must be a valid Expo push token"]}} =
               json_response(conn, 422)
    end
  end

  defp authed_conn(device_attrs) do
    suffix = System.unique_integer([:positive])

    {:ok, user} =
      Accounts.create_user(%{
        email: "push-token-#{suffix}@example.com",
        display_name: "Push Token #{suffix}"
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: device_attrs.installation_id,
        platform: device_attrs.platform,
        device_name: "Test Device"
      })

    conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{conn: conn, user: user, session: issued.session}
  end
end
