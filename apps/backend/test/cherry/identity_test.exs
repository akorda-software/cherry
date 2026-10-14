defmodule Cherry.IdentityTest do
  use Cherry.DataCase, async: false

  alias Cherry.Accounts
  alias Cherry.Identity
  alias Cherry.Identity.AgeVerification
  alias Cherry.Accounts.User
  alias Cherry.Sessions
  alias Cherry.Sessions.RefreshToken
  alias Cherry.Sessions.SessionFamily
  alias Cherry.Repo
  alias Cherry.Identity.ProviderIdentity
  alias Cherry.TestSupport.FutureProvider
  alias Cherry.TestSupport.ProviderTokenFactory

  setup do
    provider_config = ProviderTokenFactory.configure!(%{future: [module: FutureProvider]})
    on_exit(fn -> ProviderTokenFactory.restore!(provider_config) end)
    {:ok, provider_config: provider_config}
  end

  describe "resolve_provider_login/2" do
    test "creates the user and provider identity on first login", %{
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-first-user",
          "email" => "google-first-user@google.cherry.test",
          "name" => "Google First User"
        })

      params = %{
        provider_token: provider_token,
        device: %{
          installation_id: "device-1",
          platform: "ios",
          device_name: "iPhone 15"
        }
      }

      assert {:ok, %{user: user, identity: identity, claims: claims}} =
               Identity.resolve_provider_login(:google, params)

      assert user.email == "google-first-user@google.cherry.test"
      assert identity.provider == "google"
      assert identity.provider_subject == claims.subject
      assert claims.subject == "google-first-user"
      assert Repo.aggregate(ProviderIdentity, :count, :id) == 1
    end

    test "reuses the existing user for a returning provider login", %{
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "sub" => "google-returning-user",
          "email" => "google-returning-user@google.cherry.test",
          "name" => "Google Returning User"
        })

      params = %{
        provider_token: provider_token,
        device: %{
          installation_id: "device-2",
          platform: "android",
          device_name: "Pixel 9"
        }
      }

      assert {:ok, %{user: first_user}} = Identity.resolve_provider_login(:google, params)
      assert {:ok, %{user: second_user}} = Identity.resolve_provider_login(:google, params)

      assert first_user.id == second_user.id
      assert Repo.aggregate(ProviderIdentity, :count, :id) == 1
    end

    test "starts a new account when the owner deleted the previous one", %{
      provider_config: provider_config
    } do
      params = %{
        provider_token:
          ProviderTokenFactory.google_token!(provider_config.google_key, %{
            "sub" => "google-back-again",
            "email" => "google-back-again@google.cherry.test",
            "name" => "Back Again"
          })
      }

      assert {:ok, %{user: old_user}} = Identity.resolve_provider_login(:google, params)

      Repo.insert!(%AgeVerification{
        user_id: old_user.id,
        status: "verified",
        method: "nfc_dni",
        verified_at: DateTime.utc_now() |> DateTime.truncate(:second),
        document_fingerprint: :crypto.strong_rand_bytes(32)
      })

      {:ok, :deleted} = Accounts.delete_account(old_user)

      assert {:ok, %{user: new_user, identity: identity}} =
               Identity.resolve_provider_login(:google, params)

      assert new_user.id != old_user.id
      assert new_user.deleted_at == nil
      assert new_user.email == "google-back-again@google.cherry.test"
      assert identity.user_id == new_user.id
      refute Repo.get(User, old_user.id)
      assert Repo.aggregate(ProviderIdentity, :count, :id) == 1
      # The old document fingerprint is gone, so the same document can verify the new account.
      assert Repo.aggregate(AgeVerification, :count, :id) == 0

      assert {:ok, _issued} =
               Sessions.issue_session(new_user, %{
                 installation_id: "device-3",
                 platform: "android",
                 device_name: "Pixel 9"
               })
    end

    test "keeps the login blocked for an account deleted for any other reason", %{
      provider_config: provider_config
    } do
      params = %{
        provider_token:
          ProviderTokenFactory.google_token!(provider_config.google_key, %{
            "sub" => "google-removed",
            "email" => "google-removed@google.cherry.test"
          })
      }

      assert {:ok, %{user: user}} = Identity.resolve_provider_login(:google, params)

      user
      |> Ecto.Changeset.change(
        deleted_at: DateTime.utc_now() |> DateTime.truncate(:second),
        deletion_reason: "moderation"
      )
      |> Repo.update!()

      assert {:ok, %{user: same_user}} = Identity.resolve_provider_login(:google, params)
      assert same_user.id == user.id

      assert {:error, :account_deleted} =
               Sessions.issue_session(same_user, %{
                 installation_id: "device-4",
                 platform: "android",
                 device_name: "Pixel 9"
               })
    end

    test "rejects Google credentials with an invalid audience", %{
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.google_token!(provider_config.google_key, %{
          "aud" => "different-client-id"
        })

      assert {:error, :invalid_audience} =
               Identity.resolve_provider_login(:google, %{provider_token: provider_token})
    end

    test "rejects Apple credentials when the nonce does not match", %{
      provider_config: provider_config
    } do
      provider_token =
        ProviderTokenFactory.apple_token!(provider_config.apple_key, "expected-nonce")

      assert {:error, :invalid_nonce} =
               Identity.resolve_provider_login(:apple, %{
                 provider_token: provider_token,
                 nonce: "different-nonce"
               })
    end

    test "allows a future provider to plug into Identity without changing Sessions ownership" do
      assert {:ok, %{user: user, identity: identity}} =
               Identity.resolve_provider_login(:future, %{provider_token: "future-capability"})

      assert identity.provider == "future"
      assert identity.provider_subject == "future-capability"
      assert Repo.aggregate(User, :count, :id) == 1
      assert Repo.aggregate(SessionFamily, :count, :id) == 0
      assert Repo.aggregate(RefreshToken, :count, :id) == 0

      assert {:ok, issued} =
               Sessions.issue_session(user, %{
                 installation_id: "future-device-1",
                 platform: "ios",
                 device_name: "iPhone 15"
               })

      assert issued.session.refresh_token != ""
      assert Repo.aggregate(SessionFamily, :count, :id) == 1
      assert Repo.aggregate(RefreshToken, :count, :id) == 1
    end
  end
end
