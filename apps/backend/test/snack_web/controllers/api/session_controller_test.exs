defmodule SnackWeb.Controllers.Api.SessionControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.TestSupport.ProviderTokenFactory

  setup do
    provider_config = ProviderTokenFactory.configure!()
    on_exit(fn -> ProviderTokenFactory.restore!(provider_config) end)
    {:ok, provider_config: provider_config}
  end

  describe "POST /api/session/refresh" do
    test "rotates the refresh token and returns a replacement bundle", %{
      conn: conn,
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-refresh-user",
          "email" => "google-refresh-user@google.snack.test"
        })

      login_conn =
        post(conn, ~p"/api/auth/google/callback", %{
          providerToken: provider_token,
          device: %{
            installationId: "refresh-device-1",
            platform: "android",
            deviceName: "Pixel 9"
          }
        })

      %{"refreshToken" => refresh_token} = json_response(login_conn, 201)

      refresh_conn =
        post(recycle(conn), ~p"/api/session/refresh", %{
          refreshToken: refresh_token
        })

      assert %{"refreshToken" => rotated_refresh_token, "accessToken" => access_token} =
               json_response(refresh_conn, 200)

      assert rotated_refresh_token != refresh_token
      assert access_token != ""
    end

    test "rejects reuse of a rotated refresh token", %{
      conn: conn,
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-refresh-reuse",
          "email" => "google-refresh-reuse@google.snack.test"
        })

      login_conn =
        post(conn, ~p"/api/auth/google/callback", %{
          providerToken: provider_token,
          device: %{
            installationId: "refresh-device-2",
            platform: "ios",
            deviceName: "iPhone 15"
          }
        })

      %{"refreshToken" => refresh_token} = json_response(login_conn, 201)

      _ =
        post(recycle(conn), ~p"/api/session/refresh", %{
          refreshToken: refresh_token
        })

      reuse_conn =
        post(recycle(conn), ~p"/api/session/refresh", %{
          refreshToken: refresh_token
        })

      assert %{"error" => "refresh_token_reused"} = json_response(reuse_conn, 401)
    end

    test "rejects unknown refresh tokens", %{conn: conn} do
      refresh_conn =
        post(conn, ~p"/api/session/refresh", %{
          refreshToken: "missing-refresh-token"
        })

      assert %{"error" => "invalid_refresh_token"} = json_response(refresh_conn, 401)
    end
  end

  describe "DELETE /api/session" do
    test "revokes the device session for logout", %{conn: conn, provider_config: provider_config} do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-logout-user",
          "email" => "google-logout-user@google.snack.test"
        })

      login_conn =
        post(conn, ~p"/api/auth/google/callback", %{
          providerToken: provider_token,
          device: %{
            installationId: "logout-device-1",
            platform: "android",
            deviceName: "Pixel 9"
          }
        })

      %{"refreshToken" => refresh_token} = json_response(login_conn, 201)

      delete_conn =
        delete(recycle(conn), ~p"/api/session", %{
          refreshToken: refresh_token
        })

      assert response(delete_conn, 204)

      refresh_after_logout_conn =
        post(recycle(conn), ~p"/api/session/refresh", %{
          refreshToken: refresh_token
        })

      assert %{"error" => "session_revoked"} = json_response(refresh_after_logout_conn, 401)
    end
  end
end
