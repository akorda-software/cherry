defmodule SnackWeb.Controllers.Api.AuthControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts.User
  alias Snack.Repo
  alias Snack.TestSupport.ProviderTokenFactory

  setup do
    provider_config = ProviderTokenFactory.configure!()
    on_exit(fn -> ProviderTokenFactory.restore!(provider_config) end)
    {:ok, provider_config: provider_config}
  end

  describe "POST /api/auth/:provider/callback" do
    test "creates the user and returns a backend session bundle on first login", %{
      conn: conn,
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-controller-first",
          "email" => "google-controller-first@google.snack.test"
        })

      conn =
        post(conn, ~p"/api/auth/google/callback", %{
          providerToken: provider_token,
          device: %{
            installationId: "controller-device-1",
            platform: "android",
            deviceName: "Pixel 9"
          }
        })

      assert %{
               "accessToken" => access_token,
               "refreshToken" => refresh_token,
               "user" => %{"email" => "google-controller-first@google.snack.test"}
             } = json_response(conn, 201)

      assert access_token != ""
      assert refresh_token != ""
      assert Repo.aggregate(User, :count, :id) == 1
    end

    test "returns the existing user on returning login without duplicating the account", %{
      conn: conn,
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-controller-returning",
          "email" => "google-controller-returning@google.snack.test"
        })

      payload = %{
        providerToken: provider_token,
        device: %{
          installationId: "controller-device-2",
          platform: "ios",
          deviceName: "iPhone 15"
        }
      }

      first_conn = post(conn, ~p"/api/auth/google/callback", payload)
      second_conn = post(recycle(conn), ~p"/api/auth/google/callback", payload)

      assert %{"user" => %{"id" => user_id}} = json_response(first_conn, 201)
      assert %{"user" => %{"id" => ^user_id}} = json_response(second_conn, 201)
      assert Repo.aggregate(User, :count, :id) == 1
    end

    test "accepts Apple callbacks when the nonce is present", %{
      conn: conn,
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.apple_token!(provider_config.apple_key, "nonce-123", %{
          "sub" => "apple-controller-user",
          "email" => "apple-controller-user@apple.snack.test"
        })

      conn =
        post(conn, ~p"/api/auth/apple/callback", %{
          providerToken: provider_token,
          authorizationCode: "auth-code",
          idToken: provider_token,
          nonce: "nonce-123",
          device: %{
            installationId: "controller-device-3",
            platform: "ios",
            deviceName: "iPhone 15 Pro"
          }
        })

      assert %{
               "accessToken" => access_token,
               "refreshToken" => refresh_token,
               "user" => %{"email" => "apple-controller-user@apple.snack.test"}
             } = json_response(conn, 201)

      assert access_token != ""
      assert refresh_token != ""
    end

    test "rejects unsupported providers", %{conn: conn} do
      conn =
        post(conn, ~p"/api/auth/github/callback", %{
          providerToken: "ignored",
          device: %{
            installationId: "controller-device-4",
            platform: "ios",
            deviceName: "iPhone 15"
          }
        })

      assert %{"error" => "unsupported_provider"} = json_response(conn, 401)
    end

    test "rejects invalid Google credentials", %{conn: conn} do
      conn =
        post(conn, ~p"/api/auth/google/callback", %{
          providerToken: "not-a-jwt",
          device: %{
            installationId: "controller-device-5",
            platform: "android",
            deviceName: "Pixel 9"
          }
        })

      assert %{"error" => "invalid_provider_token"} = json_response(conn, 401)
    end
  end
end
