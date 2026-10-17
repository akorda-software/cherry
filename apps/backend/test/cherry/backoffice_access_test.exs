defmodule Cherry.BackofficeAccessTest do
  use Cherry.DataCase, async: true
  alias Cherry.Backoffice.{Access, Credential}

  setup do
    {:ok, staff} =
      Access.provision("staff#{System.unique_integer([:positive])}@example.test", "admin")

    %{staff: staff}
  end

  test "codes are single use, only hashed; sessions cannot log in again", %{staff: staff} do
    {:ok, code} = Access.issue_login(staff.email)
    assert byte_size(code) == 43
    refute inspect(Repo.all(Credential)) =~ code
    assert {:ok, %{staff: ^staff, token: token}} = Access.exchange(code)
    assert {:error, :invalid_code} = Access.exchange(code)
    assert {:error, :invalid_code} = Access.exchange(token)
    assert Access.authenticate(token).id == staff.id
    assert Access.authenticate(code) == nil
    assert {:ok, :ok} = Access.logout(token)
    assert Access.authenticate(token) == nil
  end

  test "issuing replaces unused codes and disabled staff lose every credential", %{staff: staff} do
    {:ok, old} = Access.issue_login(staff.email)
    {:ok, code} = Access.issue_login(staff.email)
    assert {:error, :invalid_code} = Access.exchange(old)
    {:ok, %{token: token}} = Access.exchange(code)
    {:ok, pending} = Access.issue_login(staff.email)
    {:ok, :ok} = Access.disable(staff.email)
    assert Access.authenticate(token) == nil
    assert {:error, :invalid_code} = Access.exchange(pending)
    assert {:error, :not_found} = Access.issue_login(staff.email)
  end

  test "expired codes and sessions fail closed", %{staff: staff} do
    {:ok, code} = Access.issue_login(staff.email)

    Repo.update_all(Credential,
      set: [expires_at: DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), -1)]
    )

    assert {:error, :invalid_code} = Access.exchange(code)
    {:ok, valid} = Access.issue_login(staff.email)
    {:ok, %{token: token}} = Access.exchange(valid)

    Repo.update_all(Credential,
      set: [expires_at: DateTime.add(DateTime.utc_now() |> DateTime.truncate(:second), -1)]
    )

    refute Access.authenticate(token)

    for invalid <- [nil, "", String.duplicate("a", 129), %{}] do
      assert {:error, :invalid_code} = Access.exchange(invalid)
      refute Access.authenticate(invalid)
    end
  end

  test "file delivery is exclusive and private, without a credential on stdout", %{staff: staff} do
    directory = Path.join(System.tmp_dir!(), "cherry-code-#{System.unique_integer([:positive])}")
    File.mkdir!(directory)
    File.chmod!(directory, 0o700)
    path = Path.join(directory, "code")

    on_exit(fn ->
      File.rm(path)
      File.rmdir(directory)
    end)

    assert :ok = Access.issue_login_to_file(staff.email, path)
    assert Bitwise.band(File.stat!(path).mode, 0o777) == 0o600
    assert {:error, :eexist} = Access.issue_login_to_file(staff.email, path)
    assert {:error, :absolute_path_required} = Access.issue_login_to_file(staff.email, "relative")
    assert {:ok, _} = Access.exchange(String.trim(File.read!(path)))
  end

  test "code delivery refuses a readable parent directory before creating anything", %{
    staff: staff
  } do
    path =
      Path.join(System.tmp_dir!(), "cherry-code-public-#{System.unique_integer([:positive])}")

    assert {:error, :private_directory_required} = Access.issue_login_to_file(staff.email, path)
    refute File.exists?(path)
  end

  test "invalid staff changes are errors, not partial grants", %{staff: staff} do
    {:ok, code} = Access.issue_login(staff.email)
    assert {:error, %Ecto.Changeset{}} = Access.provision(staff.email, "unknown")
    assert {:ok, _} = Access.exchange(code)
  end
end
