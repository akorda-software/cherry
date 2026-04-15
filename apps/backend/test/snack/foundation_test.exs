defmodule Snack.FoundationTest do
  use Snack.DataCase, async: false

  alias Snack.Accounts
  alias Snack.Identity
  alias Snack.Repo
  alias Snack.Sessions
  alias Snack.Identity.ProviderIdentity
  alias Snack.Sessions.RefreshToken
  alias Snack.Sessions.SessionFamily
  alias Snack.TestSupport.ProviderTokenFactory

  setup do
    provider_config = ProviderTokenFactory.configure!()
    on_exit(fn -> ProviderTokenFactory.restore!(provider_config) end)
    {:ok, provider_config: provider_config}
  end

  test "backend foundation modules are available" do
    assert Code.ensure_loaded?(Snack.Application)
    assert Code.ensure_loaded?(Snack.Repo)
  end

  test "backend auth behavior is assigned by context", %{provider_config: provider_config} do
    provider_token =
      ProviderTokenFactory.google_token!(provider_config.google_key, %{
        "sub" => "context-owned-user",
        "email" => "context-owned-user@google.snack.test",
        "name" => "Context Owned User"
      })

    assert {:ok, %{user: user, identity: identity}} =
             Identity.resolve_provider_login(:google, %{provider_token: provider_token})

    assert Accounts.get_user!(user.id).id == user.id
    assert identity.provider == "google"
    assert Repo.aggregate(ProviderIdentity, :count, :id) == 1
    assert Repo.aggregate(SessionFamily, :count, :id) == 0
    assert Repo.aggregate(RefreshToken, :count, :id) == 0

    assert {:ok, issued} =
             Sessions.issue_session(user, %{
               installation_id: "context-device-1",
               platform: "android",
               device_name: "Pixel 9"
             })

    assert issued.session.access_token != ""
    assert Repo.aggregate(SessionFamily, :count, :id) == 1
    assert Repo.aggregate(RefreshToken, :count, :id) == 1
  end
end
