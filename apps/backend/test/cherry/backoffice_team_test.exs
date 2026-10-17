defmodule Cherry.BackofficeTeamTest do
  use Cherry.DataCase, async: true
  import ExUnit.CaptureLog
  alias Cherry.Backoffice.{Access, Credential, LoginAttempt, LoginThrottle, Staff, Team}
  @password "synthetic-test-only-passphrase"

  setup do
    {:ok, owner} =
      Access.provision("owner#{System.unique_integer([:positive])}@example.test", "superadmin")

    %{owner: owner}
  end

  test "only a current superuser can create accounts, including with forged roles", %{
    owner: owner
  } do
    for role <- ~w(admin moderator privacy) do
      {:ok, staff} = Access.provision("#{role}@example.test", role)
      assert {:error, :forbidden} = Team.invite(%{staff | role: "superadmin"}, attrs())
      assert {:error, :forbidden} = Team.list(staff)
      assert {:error, :forbidden} = Team.update(staff, owner.id, %{"role" => "moderator"})
      assert {:error, :forbidden} = Team.reset_access(staff, owner.id)
    end

    assert {:ok, %{staff: %{role: "privacy"}}} = Team.invite(owner, attrs())
  end

  test "invitation chooses a personal password once; codes, passwords and hashes are not printed",
       %{owner: owner} do
    {:ok, %{staff: staff, code: code}} = Team.invite(owner, attrs())
    assert {:error, :invalid_code} = Access.exchange(code)

    log =
      capture_log([level: :debug], fn ->
        assert {:ok, %{token: token}} = Access.accept_invitation(code, @password)
        assert Access.authenticate(token).id == staff.id
      end)

    refute log =~ @password
    refute log =~ code
    refute inspect(Repo.get!(Staff, staff.id)) =~ @password
    assert {:error, :invalid_code} = Access.accept_invitation(code, @password)

    assert {:ok, %{staff: authenticated}} =
             Access.password_login(staff.email, @password, {127, 0, 0, 1})

    assert authenticated.id == staff.id

    assert {:error, :invalid_credentials} =
             Access.password_login(staff.email, "wrong", {127, 0, 0, 1})
  end

  test "invalid passwords do not consume an invitation; expired codes cannot activate", %{
    owner: owner
  } do
    {:ok, %{code: code}} = Team.invite(owner, attrs())

    for invalid <- [nil, "short", String.duplicate("x", 257)] do
      assert {:error, :invalid_invitation} = Access.accept_invitation(code, invalid)
    end

    Repo.update_all(from(c in Credential, where: c.kind == "invite"),
      set: [expires_at: DateTime.add(now(), -1)]
    )

    assert {:error, :invalid_code} = Access.accept_invitation(code, @password)
  end

  test "grant changes, disabling and resetting revoke access immediately", %{owner: owner} do
    {:ok, %{staff: staff, code: code}} = Team.invite(owner, attrs())
    {:ok, %{token: token}} = Access.accept_invitation(code, @password)

    assert {:ok, updated} =
             Team.update(owner, staff.id, %{"role" => "moderator", "disabled" => "false"})

    refute Access.authenticate(token)
    assert updated.role == "moderator"
    assert {:ok, %{code: replacement}} = Team.reset_access(owner, staff.id)

    assert {:error, :invalid_credentials} =
             Access.password_login(staff.email, @password, {127, 0, 0, 1})

    assert {:ok, %{token: new_token}} = Access.accept_invitation(replacement, @password)
    assert {:ok, _} = Team.update(owner, staff.id, %{"role" => "moderator", "disabled" => "true"})
    refute Access.authenticate(new_token)
    assert {:error, :forbidden} = Team.list(%{staff | role: "superadmin"})
  end

  test "the last superuser cannot be demoted or disabled", %{owner: owner} do
    assert {:error, :last_superadmin} = Team.update(owner, owner.id, %{"disabled" => "true"})
    assert {:error, :last_superadmin} = Team.update(owner, owner.id, %{"role" => "admin"})
    assert {:ok, %{code: code}} = Team.invite(owner, Map.put(attrs(), "role", "superadmin"))
    assert {:error, :last_superadmin} = Team.update(owner, owner.id, %{"role" => "admin"})
    assert {:ok, _} = Access.accept_invitation(code, @password)
    assert {:ok, _} = Team.update(owner, owner.id, %{"role" => "admin", "disabled" => "false"})
    assert {:error, :forbidden} = Team.list(owner)
  end

  test "duplicate emails and invalid roles cannot create partial grants", %{owner: owner} do
    attributes = attrs()
    assert {:ok, %{staff: staff, code: code}} = Team.invite(owner, attributes)
    assert {:error, %Ecto.Changeset{}} = Team.invite(owner, attributes)
    assert {:error, %Ecto.Changeset{}} = Team.update(owner, staff.id, %{"role" => "unknown"})

    assert {:error, %Ecto.Changeset{}} =
             Team.invite(owner, %{"email" => "not an email", "role" => "privacy"})

    assert {:ok, _} = Access.accept_invitation(code, @password)
  end

  test "account failures survive failed logins and recover after lockout", %{owner: owner} do
    {:ok, %{staff: staff, code: code}} = Team.invite(owner, attrs())
    {:ok, _} = Access.accept_invitation(code, @password)

    for _ <- 1..5 do
      assert {:error, :invalid_credentials} =
               Access.password_login(staff.email, "wrong", {127, 0, 0, 1})
    end

    assert Repo.get!(Staff, staff.id).failed_login_attempts == 5

    assert {:error, :invalid_credentials} =
             Access.password_login(staff.email, @password, {127, 0, 0, 2})

    Repo.update_all(from(s in Staff, where: s.id == ^staff.id),
      set: [login_blocked_until: DateTime.add(now(), -1)]
    )

    assert {:ok, _} = Access.password_login(staff.email, @password, {127, 0, 0, 2})
    assert Repo.get!(Staff, staff.id).failed_login_attempts == 0
  end

  test "IP limit is shared in the database and expires" do
    for _ <- 1..20, do: assert(LoginThrottle.allow?({127, 0, 0, 1}))
    refute LoginThrottle.allow?({127, 0, 0, 1})
    assert LoginThrottle.allow?({127, 0, 0, 2})
    Repo.update_all(LoginAttempt, set: [expires_at: DateTime.add(now(), -1)])
    assert LoginThrottle.allow?({127, 0, 0, 1})
  end

  defp attrs,
    do: %{
      "email" => "invite#{System.unique_integer([:positive])}@example.test",
      "role" => "privacy"
    }

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
