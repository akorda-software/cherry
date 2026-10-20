defmodule Cherry.Backoffice.Team do
  @moduledoc "Superadministrator-only team management, revocation and manually delivered invitations."
  import Ecto.Query
  alias Cherry.Backoffice.{Access, Credential, Staff}
  alias Cherry.Casework.Audit
  alias Cherry.Repo

  def list(actor, offset \\ 0) do
    Repo.transaction(fn ->
      Access.authorize!(actor, :manage_team)
      Repo.all(from(s in Staff, order_by: [s.email, s.id], limit: 50, offset: ^offset))
    end)
  end

  @doc """
  Operational signals per member: last sign-in, open cases assigned and the
  expiry of a pending invitation. Never credentials or session tokens.
  """
  def signals(actor, ids) do
    Repo.transaction(fn ->
      Access.authorize!(actor, :manage_team)

      %{
        last_login:
          Repo.all(
            from(a in Audit,
              where: a.action == "staff_login" and a.staff_id in ^ids,
              group_by: a.staff_id,
              select: {a.staff_id, max(a.inserted_at)}
            )
          )
          |> Map.new(),
        open_cases:
          Repo.all(
            from(c in Cherry.Casework.Case,
              where: c.status == "open" and c.assigned_staff_id in ^ids,
              group_by: c.assigned_staff_id,
              select: {c.assigned_staff_id, count(c.id)}
            )
          )
          |> Map.new(),
        invitations:
          Repo.all(
            from(c in Credential,
              where: c.kind == "invite" and c.staff_id in ^ids,
              group_by: c.staff_id,
              select: {c.staff_id, max(c.expires_at)}
            )
          )
          |> Map.new()
      }
    end)
  end

  def invite(actor, attrs) do
    manage(actor, fn actor ->
      changeset = Staff.changeset(%Staff{}, Map.take(attrs, ["email", "role"]))

      staff =
        case Repo.insert(changeset, log: false) do
          {:ok, staff} -> staff
          {:error, error} -> Repo.rollback(error)
        end

      code = invitation!(staff)

      Audit.record!("staff_invited", %{
        staff_id: actor.id,
        metadata: %{target_staff_id: staff.id, role: staff.role}
      })

      %{staff: staff, code: code}
    end)
  end

  def update(actor, id, attrs) do
    manage(actor, fn actor ->
      staff = get!(id)
      disabled = attrs["disabled"] == "true"
      role = attrs["role"] || staff.role

      if staff.role == "superadmin" and is_nil(staff.disabled_at) and
           (disabled or role != "superadmin") do
        if !Repo.exists?(
             from(s in Staff,
               where:
                 s.id != ^staff.id and s.role == "superadmin" and is_nil(s.disabled_at) and
                   not is_nil(s.password_hash)
             )
           ),
           do: Repo.rollback(:last_superadmin)
      end

      changeset = Staff.changeset(staff, %{role: role, disabled_at: if(disabled, do: now())})

      updated =
        case Repo.update(changeset, log: false) do
          {:ok, updated} -> updated
          {:error, error} -> Repo.rollback(error)
        end

      Repo.delete_all(from(c in Credential, where: c.staff_id == ^id))

      Audit.record!("staff_access_changed", %{
        staff_id: actor.id,
        metadata: %{target_staff_id: id, role: updated.role, disabled: disabled}
      })

      updated
    end)
  end

  def reset_access(actor, id) do
    manage(actor, fn actor ->
      staff = get!(id)
      if staff.disabled_at, do: Repo.rollback(:forbidden)

      Repo.update!(
        Ecto.Changeset.change(staff,
          password_hash: nil,
          failed_login_attempts: 0,
          login_blocked_until: nil
        ),
        log: false
      )

      code = invitation!(staff)
      Audit.record!("staff_access_reset", %{staff_id: actor.id, metadata: %{target_staff_id: id}})
      %{staff: staff, code: code}
    end)
  end

  defp manage(actor, fun) do
    Repo.transaction(fn ->
      # Serialize grants (including the last-owner check), then lock current
      # accounts in a fixed order. Never trust a role supplied by the browser.
      Repo.query!("SELECT pg_advisory_xact_lock(716341021)")
      Repo.all(from(s in Staff, order_by: s.id, lock: "FOR UPDATE", select: s.id))
      actor = Access.authorize!(actor, :manage_team)
      fun.(actor)
    end)
  end

  defp invitation!(staff) do
    Repo.delete_all(from(c in Credential, where: c.staff_id == ^staff.id))
    code = :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)

    Repo.insert!(
      %Credential{
        staff_id: staff.id,
        kind: "invite",
        token_hash: :crypto.hash(:sha256, code),
        expires_at: DateTime.add(now(), 86_400)
      },
      log: false
    )

    code
  end

  defp get!(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> Repo.get(Staff, id) || Repo.rollback(:not_found)
      _ -> Repo.rollback(:not_found)
    end
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
