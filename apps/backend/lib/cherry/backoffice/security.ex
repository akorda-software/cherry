defmodule Cherry.Backoffice.Security do
  @moduledoc "Explicit owner bootstrap and personal credential rotation; never default passwords."
  import Ecto.Query
  alias Cherry.Backoffice.{Credential, Password, Staff}
  alias Cherry.Casework.Audit
  alias Cherry.Repo

  def bootstrap(email, password) do
    if Password.valid?(password) do
      Repo.transaction(fn ->
        Repo.query!("SELECT pg_advisory_xact_lock(716341021)")

        if Repo.exists?(
             from(s in Staff, where: s.role == "superadmin" and is_nil(s.disabled_at))
           ),
           do: Repo.rollback(:already_bootstrapped)

        staff = %Staff{} |> Staff.changeset(%{email: email, role: "superadmin"})

        staff =
          Ecto.Changeset.change(staff,
            password_hash: Password.hash(password),
            password_change_required: true
          )

        case Repo.insert(staff, log: false) do
          {:ok, staff} ->
            Audit.record!("staff_bootstrapped", %{staff_id: staff.id})
            staff

          {:error, error} ->
            Repo.rollback(error)
        end
      end)
    else
      {:error, :invalid_password}
    end
  end

  def change_password(%Staff{id: id}, current_password, new_password) do
    if Password.valid?(new_password) and current_password != new_password do
      Repo.transaction(fn ->
        staff =
          Repo.one(
            from(s in Staff, where: s.id == ^id and is_nil(s.disabled_at), lock: "FOR UPDATE")
          ) || Repo.rollback(:forbidden)

        unless Password.verify(current_password, staff.password_hash),
          do: Repo.rollback(:invalid_credentials)

        Repo.update!(
          Ecto.Changeset.change(staff,
            password_hash: Password.hash(new_password),
            password_change_required: false,
            failed_login_attempts: 0,
            login_blocked_until: nil
          ),
          log: false
        )

        Repo.delete_all(from(c in Credential, where: c.staff_id == ^id), log: false)
        Audit.record!("staff_password_changed", %{staff_id: id})
        :ok
      end)
    else
      {:error, :invalid_password}
    end
  end
end
