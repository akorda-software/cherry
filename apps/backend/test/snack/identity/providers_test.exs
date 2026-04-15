defmodule Snack.Identity.ProvidersTest do
  use ExUnit.Case, async: false

  alias Snack.Auth
  alias Snack.Identity.Providers.Apple
  alias Snack.Identity.Providers.Google
  alias Snack.TestSupport.ProviderTokenFactory

  setup do
    provider_config = ProviderTokenFactory.configure!()
    on_exit(fn -> ProviderTokenFactory.restore!(provider_config) end)
    {:ok, provider_config: provider_config}
  end

  describe "provider_config/1" do
    test "normalizes configured provider options" do
      assert Keyword.fetch!(Auth.provider_config(:google), :module) == Google
      assert Auth.supported_provider?(:google)
      refute Auth.supported_provider?(:github)
    end

    test "normalizes bare module provider entries" do
      previous_auth_config = Application.fetch_env!(:snack, Snack.Auth)

      Application.put_env(
        :snack,
        Snack.Auth,
        Keyword.put(previous_auth_config, :providers, %{google: Google})
      )

      on_exit(fn -> Application.put_env(:snack, Snack.Auth, previous_auth_config) end)

      assert Auth.provider_config(:google) == [module: Google]
    end
  end

  describe "Google.verify/1" do
    test "accepts string-keyed params", %{provider_config: provider_config} do
      token = ProviderTokenFactory.google_token!(provider_config.google_key)

      assert {:ok, claims} = Google.verify(%{"provider_token" => token})
      assert claims.email == "google-user@example.com"
    end

    test "uses the token email prefix when a display name is absent", %{
      provider_config: provider_config
    } do
      token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "email" => "fallback-name@google.snack.test",
          "name" => nil,
          "sub" => "google-fallback-name"
        })

      assert {:ok, claims} = Google.verify(%{provider_token: token})
      assert claims.display_name == "Fallback Name"
      assert claims.provider_data["kid"] == provider_config.google_key.kid
    end

    test "rejects expired credentials", %{provider_config: provider_config} do
      token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "exp" => System.os_time(:second) - 120
        })

      assert {:error, :token_expired} = Google.verify(%{provider_token: token})
    end

    test "rejects tokens issued in the future", %{provider_config: provider_config} do
      token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "iat" => System.os_time(:second) + 120
        })

      assert {:error, :token_issued_in_future} = Google.verify(%{provider_token: token})
    end

    test "accepts the alternate Google issuer spelling", %{provider_config: provider_config} do
      token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "iss" => "accounts.google.com"
        })

      assert {:ok, claims} = Google.verify(%{provider_token: token})
      assert claims.provider_data["iss"] == "accounts.google.com"
    end

    test "rejects malformed credentials" do
      assert {:error, :invalid_provider_token} = Google.verify(%{provider_token: "not-a-jwt"})
    end

    test "rejects tokens without an email claim", %{provider_config: provider_config} do
      token = ProviderTokenFactory.google_token!(provider_config.google_key, %{"email" => nil})

      assert {:error, :invalid_provider_token} = Google.verify(%{provider_token: token})
    end
  end

  describe "Apple.verify/1" do
    test "accepts string-keyed params with an identity token", %{provider_config: provider_config} do
      identity_token =
        ProviderTokenFactory.apple_token!(provider_config.apple_key, "nonce-string-map")

      assert {:ok, claims} =
               Apple.verify(%{
                 "provider_token" => "authorization-code-placeholder",
                 "id_token" => identity_token,
                 "nonce" => "nonce-string-map"
               })

      assert claims.email == "apple-user@example.com"
    end

    test "uses the provider token when no identity token is supplied", %{
      provider_config: provider_config
    } do
      token = ProviderTokenFactory.apple_token!(provider_config.apple_key, "nonce-provider-token")

      assert {:ok, claims} = Apple.verify(%{provider_token: token, nonce: "nonce-provider-token"})
      assert claims.provider_data["kid"] == provider_config.apple_key.kid
    end

    test "prefers the identity token when it is present", %{provider_config: provider_config} do
      identity_token =
        ProviderTokenFactory.apple_token!(provider_config.apple_key, "nonce-apple", %{
          "email" => "identity-token@apple.snack.test",
          "sub" => "apple-identity-token"
        })

      assert {:ok, claims} =
               Apple.verify(%{
                 provider_token: "authorization-code-placeholder",
                 id_token: identity_token,
                 nonce: "nonce-apple"
               })

      assert claims.email == "identity-token@apple.snack.test"
      assert claims.provider_data["nonce"] == "nonce-apple"
    end

    test "rejects tokens signed with an unknown key", %{provider_config: provider_config} do
      other_key = ProviderTokenFactory.generate_signing_key("other-apple-key")
      token = ProviderTokenFactory.apple_token!(other_key, "nonce-unknown")

      assert {:error, :invalid_provider_token} =
               Apple.verify(%{provider_token: token, nonce: "nonce-unknown"})

      assert provider_config.apple_key.kid != other_key.kid
    end

    test "rejects tokens without the required email claim", %{provider_config: provider_config} do
      token =
        ProviderTokenFactory.apple_token!(provider_config.apple_key, "nonce-missing-email", %{
          "email" => nil
        })

      assert {:error, :invalid_provider_token} =
               Apple.verify(%{provider_token: token, nonce: "nonce-missing-email"})
    end

    test "rejects empty provider credentials" do
      assert {:error, :invalid_provider_token} =
               Apple.verify(%{provider_token: "", nonce: "nonce"})
    end
  end
end
