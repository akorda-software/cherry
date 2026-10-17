defmodule Cherry.BackofficeSecurityTest do
  use Cherry.DataCase, async: true
  import ExUnit.CaptureLog
  alias Cherry.Backoffice.{Access, Security, Staff, Team}
  @temporary "synthetic-temporary-passphrase"
  @personal "synthetic-personal-passphrase"

  test "one owner only, with no default password and mandatory first-use rotation" do
    assert {:error, :invalid_password} = Security.bootstrap("owner@example.test", "simple")
    assert {:ok, owner} = Security.bootstrap("owner@example.test", @temporary)
    assert owner.role == "superadmin" and owner.password_change_required
    assert {:error, :already_bootstrapped} = Security.bootstrap("other@example.test", @temporary)
    assert {:ok, %{token: token}} = Access.password_login(owner.email, @temporary, {127, 0, 0, 1})

    logs =
      capture_log([level: :debug], fn ->
        assert {:ok, :ok} = Security.change_password(owner, @temporary, @personal)
      end)

    refute logs =~ @temporary
    refute logs =~ @personal
    refute Access.authenticate(token)
    refute Repo.reload!(owner).password_change_required

    assert {:error, :invalid_credentials} =
             Access.password_login(owner.email, @temporary, {127, 0, 0, 1})

    assert {:ok, _} = Access.password_login(owner.email, @personal, {127, 0, 0, 1})
  end

  test "wrong current password, weak or same new password do not mutate access" do
    {:ok, owner} = Security.bootstrap("owner@example.test", @temporary)
    {:ok, %{token: token}} = Access.password_login(owner.email, @temporary, {127, 0, 0, 1})

    for {current, next} <- [{"wrong", @personal}, {@temporary, "short"}, {@temporary, @temporary}] do
      assert {:error, _} = Security.change_password(owner, current, next)
      assert Access.authenticate(token)
    end
  end

  test "disabled accounts cannot change passwords with stale structures" do
    {:ok, owner} = Security.bootstrap("owner@example.test", @temporary)
    {:ok, :ok} = Access.disable(owner.email)
    assert {:error, :forbidden} = Security.change_password(owner, @temporary, @personal)
    assert Repo.get!(Staff, owner.id).disabled_at
  end

  test "every staff member can rotate only their own credentials" do
    {:ok, owner} = Security.bootstrap("owner@example.test", @temporary)

    {:ok, %{staff: helper, code: code}} =
      Team.invite(owner, %{"email" => "helper@example.test", "role" => "privacy"})

    {:ok, %{token: token}} = Access.accept_invitation(code, @temporary)
    assert {:ok, :ok} = Security.change_password(helper, @temporary, @personal)
    refute Access.authenticate(token)
    assert {:ok, _} = Access.password_login(owner.email, @temporary, {127, 0, 0, 1})
  end
end
