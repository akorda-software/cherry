defmodule Cherry.Casework.Review do
  @moduledoc "Staff permissions, assignment and atomic decision lifecycle."
  import Ecto.Query
  alias Cherry.Backoffice.Access
  alias Cherry.Casework.{Audit, Case, Delivery, Pagination, Resolution}
  alias Cherry.Dating.Profile
  alias Cherry.Repo

  def queue(staff, params \\ %{}) do
    Repo.transaction(fn ->
      staff = Access.authorize!(staff, :queue)
      status = if params["status"] == "resolved", do: "resolved", else: "open"
      query = from(c in Case, where: c.status == ^status)

      query =
        case staff.role do
          "privacy" -> where(query, [c], c.kind == "privacy")
          "moderator" -> where(query, [c], c.kind != "privacy")
          role when role in ["admin", "superadmin"] -> query
        end

      Repo.all(
        from(c in query,
          order_by: [
            asc: fragment("CASE WHEN ? = 'underage' THEN 0 ELSE 1 END", c.category),
            asc: c.inserted_at,
            asc: c.id
          ],
          limit: 50,
          offset: ^Pagination.offset(params)
        )
      )
    end)
  end

  def view(staff, id) do
    with {:ok, id} <- uuid(id) do
      Repo.transaction(fn ->
        Cherry.Casework.Lifecycle.participate!()
        staff = Access.authorize!(staff, :queue)
        record = Repo.get(Case, id) || Repo.rollback(:not_found)
        if !Access.allowed?(staff, record.kind), do: Repo.rollback(:forbidden)
        Audit.record!("case_viewed", %{case_id: id, staff_id: staff.id})

        events =
          Repo.all(
            from(a in Audit,
              where: a.case_id == ^id,
              order_by: [desc: a.inserted_at, desc: a.id],
              limit: 100
            )
          )

        profile =
          if record.subject_user_id,
            do:
              Repo.one(
                from(p in Profile,
                  where: p.user_id == ^record.subject_user_id and is_nil(p.deleted_at),
                  select: %{display_name: p.display_name, bio: p.bio}
                )
              ),
            else: nil

        %{case: record, events: events, profile: profile}
      end)
    end
  end

  def claim(staff, id) do
    change_case(staff, id, fn staff, record ->
      if record.status != "open", do: Repo.rollback(:already_resolved)

      if record.assigned_staff_id && record.assigned_staff_id != staff.id,
        do: Repo.rollback(:assigned_elsewhere)

      check_independent!(staff, record)
      updated = Repo.update!(Ecto.Changeset.change(record, assigned_staff_id: staff.id))
      Audit.record!("case_assigned", %{case_id: record.id, staff_id: staff.id})
      updated
    end)
  end

  def reassign(staff, id) do
    change_case(staff, id, fn staff, record ->
      if !Access.allowed?(staff, :reassign), do: Repo.rollback(:forbidden)
      if record.status != "open", do: Repo.rollback(:already_resolved)
      check_independent!(staff, record)
      updated = Repo.update!(Ecto.Changeset.change(record, assigned_staff_id: staff.id))

      Audit.record!("case_reassigned", %{
        case_id: record.id,
        staff_id: staff.id,
        metadata: %{previous_staff_id: record.assigned_staff_id}
      })

      updated
    end)
  end

  def resolve(staff, id, attrs) do
    change_case(staff, id, fn staff, record ->
      if record.status != "open", do: Repo.rollback(:already_resolved)
      if record.assigned_staff_id != staff.id, do: Repo.rollback(:claim_required)
      check_independent!(staff, record)
      changeset = Case.resolution_changeset(record, attrs, Case.outcomes(record))
      if !changeset.valid?, do: Repo.rollback(changeset)

      record =
        Repo.update!(
          Ecto.Changeset.change(changeset,
            status: "resolved",
            decided_by_staff_id: staff.id,
            resolved_at: DateTime.utc_now() |> DateTime.truncate(:second)
          ),
          log: false
        )

      Resolution.apply!(record)
      Delivery.resolution!(record)

      Audit.record!("case_resolved", %{
        case_id: record.id,
        staff_id: staff.id,
        metadata: %{outcome: record.outcome}
      })

      record
    end)
  end

  defp change_case(staff, id, fun) do
    with {:ok, id} <- uuid(id) do
      Repo.transaction(fn ->
        Cherry.Casework.Lifecycle.participate!()
        staff = Access.authorize!(staff, :queue)

        record =
          Repo.one(from(c in Case, where: c.id == ^id, lock: "FOR UPDATE")) ||
            Repo.rollback(:not_found)

        if !Access.allowed?(staff, record.kind), do: Repo.rollback(:forbidden)
        fun.(staff, record)
      end)
    end
  end

  defp check_independent!(staff, %Case{parent_case_id: parent_id}) when not is_nil(parent_id) do
    case Repo.get(Case, parent_id) do
      %Case{decided_by_staff_id: id} when id == staff.id ->
        Repo.rollback(:independent_reviewer_required)

      %Case{} ->
        :ok

      _ ->
        Repo.rollback(:parent_unavailable)
    end
  end

  defp check_independent!(_, _), do: :ok

  defp uuid(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> {:ok, id}
      _ -> {:error, :not_found}
    end
  end
end
