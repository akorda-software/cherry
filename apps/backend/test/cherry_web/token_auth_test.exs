defmodule CherryWeb.TokenAuthTest do
  use Cherry.DataCase, async: true

  alias Cherry.Accounts
  alias Cherry.Repo
  alias Cherry.Sessions
  alias Cherry.Sessions.SessionFamily
  alias CherryWeb.TokenAuth

  defp create_user! do
    {:ok, user} =
      Accounts.create_user(%{
        email: "token-auth@example.com",
        display_name: "Token Auth"
      })

    user
  end

  defp issue_session(user) do
    Sessions.issue_session(user, %{
      installation_id: Ecto.UUID.generate(),
      platform: "ios",
      device_name: "Test Device"
    })
  end

  defp sign_access_token(user, session_family_id, exp) do
    Phoenix.Token.sign(CherryWeb.Endpoint, Cherry.Auth.access_token_salt(), %{
      sub: user.id,
      session_id: session_family_id,
      exp: exp
    })
  end

  describe "authenticate/1" do
    test "accepts a valid access token" do
      user = create_user!()
      {:ok, issued} = issue_session(user)

      assert {:ok, %{user: authenticated_user}} =
               TokenAuth.authenticate(issued.session.access_token)

      assert authenticated_user.id == user.id
    end

    test "rejects expired access tokens" do
      user = create_user!()
      {:ok, _issued} = issue_session(user)
      session_family = Repo.one!(SessionFamily)

      token = sign_access_token(user, session_family.id, System.os_time(:second) - 1)

      assert {:error, :token_expired} = TokenAuth.authenticate(token)
    end

    test "rejects access tokens for revoked session families" do
      user = create_user!()
      {:ok, issued} = issue_session(user)

      :ok = Sessions.revoke_session(issued.session.refresh_token)

      assert {:error, :session_revoked} = TokenAuth.authenticate(issued.session.access_token)
    end
  end
end
