defmodule Cherry.Casework.Review do
  @moduledoc "Staff permissions, assignment and atomic decision lifecycle."
  import Ecto.Query
  alias Cherry.Backoffice.{Access, Credential, Staff}
  alias Cherry.Casework.{Audit, Case, Delivery, Note, Pagination, Resolution, Workbench}
  alias Cherry.Dating.Profile
  alias Cherry.Repo

  @kinds ~w(report complaint appeal measure privacy)

  @doc """
  One page of the staff queue. Filters: `status` (open/resolved, or `all` for
  searches), `kind`, `category`, `owner` (`me`/`none`) and `q` (case id or its
  first characters).
  """
  def queue(staff, params \\ %{}) do
    Repo.transaction(fn ->
      staff = Access.authorize!(staff, :queue)
      status = if params["status"] in ["resolved", "all"], do: params["status"], else: "open"

      from(c in Case)
      |> filter_status(status)
      |> visible_to(staff)
      |> filter_kind(params["kind"])
      |> filter_category(params["category"])
      |> filter_owner(params["owner"], staff, status)
      |> filter_search(params["q"])
      |> order_queue(status)
      |> limit(50)
      |> offset(^Pagination.offset(params))
      |> Repo.all()
    end)
  end

  @doc "Restricts a case query to the kinds the member's current role may handle."
  def visible_to(query, %Staff{role: "privacy"}), do: where(query, [c], c.kind == "privacy")
  def visible_to(query, %Staff{role: "moderator"}), do: where(query, [c], c.kind != "privacy")

  def visible_to(query, %Staff{role: role}) when role in ["admin", "superadmin"], do: query

  @doc "Possible minors first, then the oldest request."
  def priority_order(query) do
    order_by(query, [c],
      asc: fragment("CASE WHEN ? = 'underage' THEN 0 ELSE 1 END", c.category),
      asc: c.inserted_at,
      asc: c.id
    )
  end

  defp filter_status(query, "all"), do: query
  defp filter_status(query, status), do: where(query, [c], c.status == ^status)

  defp order_queue(query, "open"), do: priority_order(query)

  defp order_queue(query, "resolved"),
    do: order_by(query, [c], desc_nulls_last: c.resolved_at, desc: c.id)

  defp order_queue(query, "all"), do: order_by(query, [c], desc: c.inserted_at, desc: c.id)

  defp filter_kind(query, kind) when kind in @kinds, do: where(query, [c], c.kind == ^kind)
  defp filter_kind(query, _), do: query

  def filter_category(query, category) when is_binary(category) do
    if Regex.match?(~r/\A[a-z_]{2,40}\z/, category),
      do: where(query, [c], c.category == ^category),
      else: query
  end

  def filter_category(query, _), do: query

  defp filter_owner(query, "me", staff, "open"),
    do: where(query, [c], c.assigned_staff_id == ^staff.id)

  defp filter_owner(query, "me", staff, "resolved"),
    do: where(query, [c], c.decided_by_staff_id == ^staff.id)

  defp filter_owner(query, "none", _staff, "open"),
    do: where(query, [c], is_nil(c.assigned_staff_id))

  defp filter_owner(query, _, _, _), do: query

  defp filter_search(query, q) when is_binary(q) do
    case search_term(q) do
      nil -> query
      {:id, id} -> where(query, [c], c.id == ^id)
      {:prefix, prefix} -> where(query, [c], fragment("?::text LIKE ?", c.id, ^(prefix <> "%")))
      :invalid -> where(query, [c], false)
    end
  end

  defp filter_search(query, _), do: query

  @doc "Parses a case search: a full id, its first characters (≥ 4) or nothing."
  def search_term(q) when is_binary(q) do
    term = q |> String.trim() |> String.downcase()

    cond do
      term == "" -> nil
      match?({:ok, _}, Ecto.UUID.cast(term)) -> {:id, term}
      Regex.match?(~r/\A[0-9a-f][0-9a-f-]{3,35}\z/, term) -> {:prefix, term}
      true -> :invalid
    end
  end

  def search_term(_), do: nil

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

        Map.merge(
          %{case: record, events: events, profile: profile},
          Workbench.context(staff, record, events)
        )
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

  @doc """
  Assigns the member the highest-priority unassigned case they may resolve.
  Skips cases locked by a concurrent claim and reviews of their own decisions.
  """
  def claim_next(staff) do
    Repo.transaction(fn ->
      Cherry.Casework.Lifecycle.participate!()
      staff = Access.authorize!(staff, :queue)
      own_decisions = from(p in Case, where: p.decided_by_staff_id == ^staff.id, select: p.id)

      record =
        from(c in Case,
          where: c.status == "open" and is_nil(c.assigned_staff_id),
          where: is_nil(c.parent_case_id) or c.parent_case_id not in subquery(own_decisions),
          limit: 1,
          lock: "FOR UPDATE SKIP LOCKED"
        )
        |> visible_to(staff)
        |> priority_order()
        |> Repo.one()

      if !record, do: Repo.rollback(:empty)
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

  @doc """
  Administration hands an open case to another active member who may resolve
  it (an appeal never goes to whoever decided the original).
  """
  def assign(staff, id, target_id) do
    change_case(staff, id, fn staff, record ->
      if !Access.allowed?(staff, :reassign), do: Repo.rollback(:forbidden)
      if record.status != "open", do: Repo.rollback(:already_resolved)
      # Read without a row lock: team changes lock every member in id order.
      target = assignable_member(target_id, record) || Repo.rollback(:invalid_assignee)
      check_independent!(target, record)

      if record.assigned_staff_id == target.id do
        record
      else
        updated = Repo.update!(Ecto.Changeset.change(record, assigned_staff_id: target.id))

        Audit.record!("case_reassigned", %{
          case_id: record.id,
          staff_id: staff.id,
          metadata: %{previous_staff_id: record.assigned_staff_id, target_staff_id: target.id}
        })

        updated
      end
    end)
  end

  @doc "Returns an open case to the queue: its assignee or administration."
  def release(staff, id) do
    change_case(staff, id, fn staff, record ->
      if record.status != "open", do: Repo.rollback(:already_resolved)

      cond do
        is_nil(record.assigned_staff_id) ->
          record

        record.assigned_staff_id == staff.id or Access.allowed?(staff, :reassign) ->
          updated = Repo.update!(Ecto.Changeset.change(record, assigned_staff_id: nil))

          Audit.record!("case_released", %{
            case_id: record.id,
            staff_id: staff.id,
            metadata:
              if(record.assigned_staff_id == staff.id,
                do: %{},
                else: %{previous_staff_id: record.assigned_staff_id}
              )
          })

          updated

        true ->
          Repo.rollback(:forbidden)
      end
    end)
  end

  @doc "Internal note for the team. The audit records that it exists, never its text."
  def add_note(staff, id, body) do
    with {:ok, id} <- uuid(id) do
      Repo.transaction(fn ->
        Cherry.Casework.Lifecycle.participate!()
        staff = Access.authorize!(staff, :queue)
        record = Repo.get(Case, id) || Repo.rollback(:not_found)
        if !Access.allowed?(staff, record.kind), do: Repo.rollback(:forbidden)

        note =
          %Note{case_id: record.id, staff_id: staff.id}
          |> Note.changeset(%{body: body})
          |> Repo.insert(log: false)
          |> case do
            {:ok, note} -> note
            {:error, changeset} -> Repo.rollback(changeset)
          end

        Audit.record!("case_note_added", %{case_id: record.id, staff_id: staff.id})
        note
      end)
    end
  end

  @doc "Active, activated members that may resolve this case."
  def assignable(record) do
    Repo.all(from(s in working_staff(), order_by: [s.email, s.id]))
    |> Enum.filter(&Access.allowed?(&1, record.kind))
    |> Enum.reject(&(&1.id == original_decider(record)))
  end

  defp assignable_member(target_id, record) do
    with {:ok, target_id} <- Ecto.UUID.cast(target_id),
         %Staff{} = target <- Repo.one(from(s in working_staff(), where: s.id == ^target_id)),
         true <- Access.allowed?(target, record.kind) do
      target
    else
      _ -> nil
    end
  end

  # Members who can sign in now: not disabled and not waiting on an invitation.
  # Console-provisioned members have no password and sign in with one-time codes.
  defp working_staff do
    from(s in Staff,
      as: :staff,
      where: is_nil(s.disabled_at),
      where:
        not is_nil(s.password_hash) or
          not exists(
            from(c in Credential,
              where: c.staff_id == parent_as(:staff).id and c.kind == "invite",
              select: 1
            )
          )
    )
  end

  defp original_decider(%Case{parent_case_id: nil}), do: nil

  defp original_decider(%Case{parent_case_id: parent_id}),
    do: Repo.one(from(p in Case, where: p.id == ^parent_id, select: p.decided_by_staff_id))

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
