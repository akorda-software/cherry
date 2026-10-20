defmodule Cherry.Casework.Workbench do
  @moduledoc """
  Read-only views for the staff panel: workload, the context of a case, active
  measures and the activity log. Never mutates; viewing a case is audited by
  `Review.view/2`, which calls `context/3` inside its own transaction.

  Account context is limited to state and the current public profile text. No
  chats, photos, identity documents, locations or who reported.
  """
  import Ecto.Query
  alias Cherry.Accounts.User
  alias Cherry.Backoffice.{Access, Credential, Staff}
  alias Cherry.Casework.{Audit, Case, Deadlines, Note, Pagination, Review}
  alias Cherry.Dating.Profile
  alias Cherry.Identity.AgeVerification
  alias Cherry.Repo

  @case_fields [:id, :kind, :category, :status, :outcome, :inserted_at, :resolved_at]

  @activity_groups %{
    "decisions" => ~w(case_resolved case_reopened),
    "assignments" => ~w(case_assigned case_reassigned case_released),
    "notes" => ~w(case_note_added),
    "views" => ~w(case_viewed),
    "intake" => ~w(case_created appeal_created measure_preserved measure_review_preserved),
    "team" =>
      ~w(staff_invited staff_access_changed staff_access_reset staff_invitation_accepted staff_provisioned staff_disabled staff_bootstrapped),
    "access" =>
      ~w(staff_login staff_logout login_issued staff_password_changed staff_sessions_revoked)
  }

  def activity_groups, do: Map.keys(@activity_groups)

  # The home page shows casework and team changes, not who opened what or signed in.
  @quiet_actions ["case_viewed" | @activity_groups["access"]]

  @doc "Workload of the member's areas: counters, their cases and the head of the queue."
  def overview(staff) do
    Repo.transaction(fn ->
      staff = Access.authorize!(staff, :queue)
      open = from(c in Case, where: c.status == "open") |> Review.visible_to(staff)

      counts =
        Repo.one(
          from(c in open,
            select: %{
              open: count(c.id),
              unassigned: filter(count(c.id), is_nil(c.assigned_staff_id)),
              mine: filter(count(c.id), c.assigned_staff_id == ^staff.id),
              priority: filter(count(c.id), c.category == "underage"),
              appeals: filter(count(c.id), c.kind == "appeal")
            }
          )
        )

      week_ago = DateTime.add(now(), -7 * 86_400)

      resolved_week =
        from(c in Case, where: c.status == "resolved" and c.resolved_at >= ^week_ago)
        |> Review.visible_to(staff)
        |> Repo.aggregate(:count)

      manage? = Access.allowed?(staff, :manage_team)

      activity =
        if manage?,
          do:
            Repo.all(
              from(a in Audit,
                where: a.action not in ^@quiet_actions,
                order_by: [desc: a.inserted_at, desc: a.id],
                limit: 6
              )
            ),
          else: []

      %{
        counts: Map.put(counts, :resolved_week, resolved_week),
        privacy: if(Access.allowed?(staff, "privacy"), do: privacy_deadlines()),
        mine:
          from(c in open, where: c.assigned_staff_id == ^staff.id, limit: 8)
          |> Review.priority_order()
          |> Repo.all(),
        next:
          from(c in open, where: is_nil(c.assigned_staff_id), limit: 5)
          |> Review.priority_order()
          |> Repo.all(),
        measures:
          if(Access.allowed?(staff, "report"),
            do: Repo.aggregate(active_measures(), :count)
          ),
        team: if(manage?, do: team_summary()),
        activity: activity,
        names: names(Enum.flat_map(activity, &event_staff_ids/1))
      }
    end)
  end

  defp privacy_deadlines do
    today = Date.utc_today()

    dates =
      Repo.all(
        from(c in Case,
          where: c.status == "open" and c.kind == "privacy",
          select: %{kind: c.kind, inserted_at: c.inserted_at}
        )
      )
      |> Enum.map(&Deadlines.response_date/1)

    %{
      due_soon: Enum.count(dates, &(Date.diff(&1, today) in 0..7)),
      overdue: Enum.count(dates, &(Date.compare(today, &1) == :gt))
    }
  end

  defp team_summary do
    now = now()

    invited =
      from(c in Credential, where: c.kind == "invite", distinct: true, select: %{id: c.staff_id})

    Repo.one(
      from(s in Staff,
        left_join: i in subquery(invited),
        on: i.id == s.id,
        where: is_nil(s.disabled_at),
        select: %{
          active: filter(count(s.id), not is_nil(s.password_hash) or is_nil(i.id)),
          pending: filter(count(s.id), is_nil(s.password_hash) and not is_nil(i.id)),
          blocked: filter(count(s.id), s.login_blocked_until > ^now)
        }
      )
    )
  end

  @doc "Counters for the queue filters, each one respecting the other active filter."
  def queue_counts(staff, params) do
    Repo.transaction(fn ->
      staff = Access.authorize!(staff, :queue)
      status = if params["status"] == "resolved", do: "resolved", else: "open"

      base =
        from(c in Case, where: c.status == ^status)
        |> Review.visible_to(staff)
        |> Review.filter_category(params["category"])

      by_owner =
        case {params["owner"], status} do
          {"me", "open"} -> where(base, [c], c.assigned_staff_id == ^staff.id)
          {"me", "resolved"} -> where(base, [c], c.decided_by_staff_id == ^staff.id)
          {"none", "open"} -> where(base, [c], is_nil(c.assigned_staff_id))
          _ -> base
        end

      kinds =
        Repo.all(from(c in by_owner, group_by: c.kind, select: {c.kind, count(c.id)}))
        |> Map.new()

      by_kind =
        if params["kind"] in ~w(report complaint appeal measure privacy),
          do: where(base, [c], c.kind == ^params["kind"]),
          else: base

      owner_column = if status == "open", do: :assigned_staff_id, else: :decided_by_staff_id

      owners =
        Repo.one(
          from(c in by_kind,
            select: %{
              all: count(c.id),
              me: filter(count(c.id), field(c, ^owner_column) == ^staff.id),
              none: filter(count(c.id), is_nil(c.assigned_staff_id))
            }
          )
        )

      %{kinds: kinds, owners: owners}
    end)
  end

  @doc "Account, history, linked cases, notes and names shown next to a case."
  def context(%Staff{} = staff, %Case{} = record, events) do
    related = related(staff, record)

    linked =
      MapSet.new([related.parent && related.parent.id | Enum.map(related.children, & &1.id)])

    account = account(record)

    history =
      if account && account.relation == :subject,
        do: Enum.reject(history(staff, record), &MapSet.member?(linked, &1.id)),
        else: []

    notes =
      Repo.all(
        from(n in Note, where: n.case_id == ^record.id, order_by: [asc: n.inserted_at, asc: n.id])
      )

    assignable =
      if record.status == "open" and Access.allowed?(staff, :reassign),
        do: Review.assignable(record),
        else: []

    staff_ids =
      [record.assigned_staff_id, record.decided_by_staff_id] ++
        Enum.map(notes, & &1.staff_id) ++ Enum.flat_map(events, &event_staff_ids/1)

    %{
      account: account,
      history: history,
      related: related,
      notes: notes,
      assignable: assignable,
      appeal_by: appeal_by(record),
      names: names(staff_ids)
    }
  end

  # Reports, appeals and measures concern the reported account; privacy
  # requests and complaints concern whoever filed them.
  defp account(%Case{kind: kind} = record) do
    {relation, user_id} =
      if kind in ~w(privacy complaint),
        do: {:requester, record.requester_user_id},
        else: {:subject, record.subject_user_id}

    user =
      user_id &&
        Repo.one(
          from(u in User,
            where: u.id == ^user_id,
            select: map(u, [:id, :inserted_at, :suspended_at, :suspension_case_id, :deleted_at])
          )
        )

    if user do
      profile =
        Repo.one(
          from(p in Profile,
            where: p.user_id == ^user.id and is_nil(p.deleted_at),
            select:
              map(p, [
                :display_name,
                :birth_date,
                :bio,
                :is_paused,
                :is_discoverable,
                :is_complete
              ])
          )
        )

      verification =
        Repo.one(
          from(v in AgeVerification,
            where: v.user_id == ^user.id,
            select: map(v, [:status, :method, :verified_at])
          )
        )

      %{
        relation: relation,
        id: user.id,
        member_since: user.inserted_at,
        suspended_at: user.suspended_at,
        suspension_case_id: user.suspension_case_id,
        deleted: not is_nil(user.deleted_at),
        profile: profile && Map.put(profile, :age, Profile.age(profile)),
        verification: verification
      }
    end
  end

  defp history(staff, %Case{subject_user_id: subject} = record) do
    from(c in Case,
      where: c.subject_user_id == ^subject and c.id != ^record.id,
      order_by: [desc: c.inserted_at, desc: c.id],
      limit: 15,
      select: map(c, ^@case_fields)
    )
    |> Review.visible_to(staff)
    |> Repo.all()
  end

  defp related(staff, record) do
    parent =
      record.parent_case_id &&
        Repo.one(
          from(c in Case, where: c.id == ^record.parent_case_id, select: map(c, ^@case_fields))
        )

    children =
      from(c in Case,
        where: c.parent_case_id == ^record.id,
        order_by: [asc: c.inserted_at, asc: c.id],
        select: map(c, ^@case_fields)
      )
      |> Review.visible_to(staff)
      |> Repo.all()

    %{
      parent: if(parent && Access.allowed?(staff, parent.kind), do: parent),
      children: children
    }
  end

  # Who asked for the review: the measure's account, whoever reported or claimed.
  defp appeal_by(%Case{kind: "appeal", subject_user_id: nil}), do: :claimant
  defp appeal_by(%Case{kind: "appeal", requester_user_id: id, subject_user_id: id}), do: :affected
  defp appeal_by(%Case{kind: "appeal"}), do: :reporter
  defp appeal_by(_), do: nil

  @doc "Accounts currently suspended, with the deciding case and any review."
  def measures(staff, params \\ %{}) do
    Repo.transaction(fn ->
      staff = Access.authorize!(staff, :queue)
      if !Access.allowed?(staff, "report"), do: Repo.rollback(:forbidden)

      rows =
        Repo.all(
          from([u, c] in active_measures(),
            left_join: p in Profile,
            on: p.user_id == u.id and is_nil(p.deleted_at),
            order_by: [asc: u.suspended_at, asc: u.id],
            limit: 50,
            offset: ^Pagination.offset(params),
            select: %{
              case_id: c.id,
              kind: c.kind,
              category: c.category,
              suspended_at: u.suspended_at,
              decided_by_staff_id: c.decided_by_staff_id,
              display_name: p.display_name
            }
          )
        )

      case_ids = Enum.map(rows, & &1.case_id)

      appeals =
        Repo.all(
          from(a in Case,
            where: a.kind == "appeal" and a.parent_case_id in ^case_ids,
            order_by: [asc: a.inserted_at],
            select: map(a, [:id, :parent_case_id, :status, :outcome])
          )
        )
        |> Enum.group_by(& &1.parent_case_id)

      %{
        measures: Enum.map(rows, &Map.put(&1, :appeals, Map.get(appeals, &1.case_id, []))),
        names: names(Enum.map(rows, & &1.decided_by_staff_id))
      }
    end)
  end

  defp active_measures do
    from(u in User,
      join: c in Case,
      on: c.id == u.suspension_case_id,
      where: not is_nil(u.suspended_at) and is_nil(u.deleted_at)
    )
  end

  @doc """
  Superuser-only audit log. By default it hides case views, which are the
  bulk of the log; `group` and `person` narrow it down.
  """
  def activity(actor, params \\ %{}) do
    Repo.transaction(fn ->
      Access.authorize!(actor, :manage_team)

      query =
        from(a in Audit,
          order_by: [desc: a.inserted_at, desc: a.id],
          limit: 50,
          offset: ^Pagination.offset(params)
        )

      query =
        case {params["group"], Map.get(@activity_groups, params["group"])} do
          {"all", _} -> query
          {_, nil} -> where(query, [a], a.action != "case_viewed")
          {_, actions} -> where(query, [a], a.action in ^actions)
        end

      query =
        case Ecto.UUID.cast(params["person"] || "") do
          {:ok, id} -> where(query, [a], a.staff_id == ^id)
          _ -> query
        end

      entries = Repo.all(query)

      %{
        entries: entries,
        names: names(Enum.flat_map(entries, &event_staff_ids/1)),
        people:
          Repo.all(
            from(s in Staff, order_by: [s.email, s.id], select: %{id: s.id, email: s.email})
          )
      }
    end)
  end

  @doc "Staff ids mentioned by an audit event: who acted and whom it concerned."
  def event_staff_ids(%Audit{staff_id: staff_id, metadata: metadata}) do
    metadata = metadata || %{}

    [
      staff_id,
      metadata["previous_staff_id"],
      metadata["target_staff_id"]
    ]
  end

  @doc "Emails of team members by id, for timelines and listings."
  def names(ids) do
    ids =
      ids
      |> Enum.flat_map(fn id ->
        case Ecto.UUID.cast(id) do
          {:ok, id} -> [id]
          _ -> []
        end
      end)
      |> Enum.uniq()

    if ids == [],
      do: %{},
      else: Repo.all(from(s in Staff, where: s.id in ^ids, select: {s.id, s.email})) |> Map.new()
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
