defmodule Snack.SessionsTest do
  use Snack.DataCase, async: true

  alias Snack.Accounts
  alias Snack.Sessions
  alias Snack.Sessions.RefreshToken
  alias Snack.Sessions.SessionFamily
  alias Snack.Repo

  defp create_user! do
    {:ok, user} =
      Accounts.create_user(%{
        email: "session-user@example.com",
        display_name: "Session User"
      })

    user
  end

  defp device_attrs do
    %{
      installation_id: Ecto.UUID.generate(),
      platform: "ios",
      device_name: "iPhone 15"
    }
  end

  describe "issue_session/2" do
    test "creates a device-scoped session family and token bundle" do
      user = create_user!()

      assert {:ok, issued} = Sessions.issue_session(user, device_attrs())

      assert issued.session.user.id == user.id
      assert issued.session.refresh_token != ""
      assert issued.session.access_token != ""
      assert Repo.aggregate(SessionFamily, :count, :id) == 1
      assert Repo.aggregate(RefreshToken, :count, :id) == 1
    end
  end

  describe "refresh_session/1" do
    test "rotates the refresh token and invalidates the prior token" do
      user = create_user!()
      {:ok, issued} = Sessions.issue_session(user, device_attrs())

      assert {:ok, refreshed} = Sessions.refresh_session(issued.session.refresh_token)
      assert refreshed.session.refresh_token != issued.session.refresh_token

      assert {:error, :refresh_token_reused} =
               Sessions.refresh_session(issued.session.refresh_token)
    end

    test "revokes the entire family after refresh token reuse" do
      user = create_user!()
      {:ok, issued} = Sessions.issue_session(user, device_attrs())
      {:ok, _refreshed} = Sessions.refresh_session(issued.session.refresh_token)

      assert {:error, :refresh_token_reused} =
               Sessions.refresh_session(issued.session.refresh_token)

      family = Repo.one!(SessionFamily)
      assert family.revoked_at != nil
    end
  end
end
