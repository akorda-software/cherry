defmodule Cherry.CaseworkWorkbenchTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  import Ecto.Query
  alias Cherry.{Accounts, Casework, Dating}
  alias Cherry.Backoffice.{Access, Team}
  alias Cherry.Casework.{Audit, Case, Note}

  setup do
    users = for _ <- 1..4, do: user_fixture()
    [a, b, c, d] = Enum.map(users, &complete_profile_fixture/1)

    %{
      users: users,
      a: a,
      b: b,
      c: c,
      d: d,
      staff: provision!("moderator"),
      other: provision!("moderator"),
      privacy: provision!("privacy"),
      admin: provision!("admin"),
      owner: provision!("superadmin")
    }
  end

  test "claim_next serves possible minors first, then the oldest, never the member's own appeal",
       ctx do
    old = report!(ctx.a, ctx.b, "harassment")
    age!(old, 3 * 86_400)
    minor = report!(ctx.c, ctx.d, "underage")

    assert {:ok, %Case{id: first, assigned_staff_id: holder}} = Casework.claim_next(ctx.staff)
    assert first == minor.id and holder == ctx.staff.id
    assert {:ok, %Case{id: second}} = Casework.claim_next(ctx.staff)
    assert second == old.id
    assert {:error, :empty} = Casework.claim_next(ctx.staff)
    assert {:error, :empty} = Casework.claim_next(ctx.privacy)

    assert Repo.exists?(
             from(a in Audit,
               where:
                 a.case_id == ^minor.id and a.action == "case_assigned" and
                   a.staff_id == ^ctx.staff.id
             )
           )

    {:ok, _} = Casework.resolve(ctx.staff, old.id, resolution("suspend"))
    subject = Repo.get!(Accounts.User, ctx.b.user_id)

    {:ok, appeal} =
      Casework.appeal(subject, old.id, %{"statement" => "Pido una revisión humana de la medida."})

    assert {:error, :empty} = Casework.claim_next(ctx.staff)
    assert {:ok, %Case{id: taken}} = Casework.claim_next(ctx.other)
    assert taken == appeal.id
  end

  test "assign hands open cases only to working members allowed and independent", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    assert {:error, :forbidden} = Casework.assign(ctx.staff, record.id, ctx.other.id)
    assert {:error, :invalid_assignee} = Casework.assign(ctx.admin, record.id, ctx.privacy.id)

    assert {:error, :invalid_assignee} =
             Casework.assign(ctx.admin, record.id, Ecto.UUID.generate())

    assert {:error, :invalid_assignee} = Casework.assign(ctx.admin, record.id, "not-an-id")

    {:ok, %{staff: invited}} =
      Team.invite(ctx.owner, %{"email" => unique_email("pending"), "role" => "moderator"})

    assert {:error, :invalid_assignee} = Casework.assign(ctx.admin, record.id, invited.id)
    refute Enum.any?(Casework.Review.assignable(record), &(&1.id == invited.id))

    {:ok, :ok} = Access.disable(ctx.other.email)
    assert {:error, :invalid_assignee} = Casework.assign(ctx.admin, record.id, ctx.other.id)

    # Console-provisioned members have no password: they sign in with one-time codes.
    assert {:ok, %Case{assigned_staff_id: holder}} =
             Casework.assign(ctx.admin, record.id, ctx.staff.id)

    assert holder == ctx.staff.id

    assert [%Audit{staff_id: actor, metadata: %{"target_staff_id" => target}}] =
             Repo.all(
               from(a in Audit, where: a.case_id == ^record.id and a.action == "case_reassigned")
             )

    assert actor == ctx.admin.id and target == ctx.staff.id

    {:ok, _} = Casework.resolve(ctx.staff, record.id, resolution("suspend"))
    assert {:error, :already_resolved} = Casework.assign(ctx.admin, record.id, ctx.admin.id)

    subject = Repo.get!(Accounts.User, ctx.b.user_id)

    {:ok, appeal} =
      Casework.appeal(subject, record.id, %{"statement" => "Solicito que lo revise otra persona."})

    assert {:error, :independent_reviewer_required} =
             Casework.assign(ctx.admin, appeal.id, ctx.staff.id)

    refute Enum.any?(Casework.Review.assignable(appeal), &(&1.id == ctx.staff.id))

    assert {:ok, %Case{assigned_staff_id: admin_id}} =
             Casework.assign(ctx.admin, appeal.id, ctx.admin.id)

    assert admin_id == ctx.admin.id
  end

  test "release frees a case for its holder or a reassigning admin only", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    assert {:error, :forbidden} = Casework.release(ctx.other, record.id)
    assert {:error, :forbidden} = Casework.release(ctx.privacy, record.id)
    assert {:ok, %Case{assigned_staff_id: nil}} = Casework.release(ctx.staff, record.id)
    {:ok, _} = Casework.claim(ctx.other, record.id)
    assert {:ok, %Case{assigned_staff_id: nil}} = Casework.release(ctx.admin, record.id)

    metadata =
      Repo.all(
        from(a in Audit,
          where: a.case_id == ^record.id and a.action == "case_released",
          select: a.metadata
        )
      )

    assert Enum.sort_by(metadata, &map_size/1) == [%{}, %{"previous_staff_id" => ctx.other.id}]
  end

  test "notes are validated, audited without content, kept out of SQL logs and erased with the case",
       ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    assert {:error, %Ecto.Changeset{}} = Casework.add_note(ctx.staff, record.id, "   ")

    assert {:error, %Ecto.Changeset{}} =
             Casework.add_note(ctx.staff, record.id, String.duplicate("x", 2001))

    assert {:error, :forbidden} = Casework.add_note(ctx.privacy, record.id, "Nota ajena")
    assert {:error, :not_found} = Casework.add_note(ctx.staff, "bad-id", "Nota sin expediente")

    require Logger
    level = Logger.level()
    Logger.configure(level: :debug)
    on_exit(fn -> Logger.configure(level: level) end)

    logs =
      ExUnit.CaptureLog.capture_log([level: :debug], fn ->
        Logger.debug("note-log-capture-active")

        assert {:ok, %Note{body: "PRIVATE_NOTE_BODY_ONLY comprobado"}} =
                 Casework.add_note(ctx.staff, record.id, "  PRIVATE_NOTE_BODY_ONLY comprobado  ")
      end)

    Logger.configure(level: level)
    assert logs =~ "note-log-capture-active"
    refute logs =~ "PRIVATE_NOTE_BODY_ONLY"

    assert [%Audit{staff_id: author, metadata: metadata}] =
             Repo.all(
               from(a in Audit, where: a.case_id == ^record.id and a.action == "case_note_added")
             )

    assert author == ctx.staff.id and metadata == %{}
    {:ok, _} = Casework.add_note(ctx.other, record.id, "Segunda nota del equipo")

    assert {:ok, %{notes: [first, second], names: names}} = Casework.view(ctx.admin, record.id)
    assert first.body =~ "PRIVATE_NOTE_BODY_ONLY" and second.staff_id == ctx.other.id
    assert names[ctx.staff.id] == ctx.staff.email

    [reporter | _] = ctx.users
    assert {:ok, :deleted} = Accounts.delete_account(reporter)
    refute Repo.get(Case, record.id)
    assert Repo.aggregate(Note, :count) == 0
  end

  test "queue filters by kind, owner and category, and searches by reference", ctx do
    harassment = report!(ctx.a, ctx.b, "harassment")
    minor = report!(ctx.c, ctx.d, "underage")
    [_, _, requester, _] = ctx.users

    {:ok, complaint} =
      Casework.submit(requester, %{
        "kind" => "complaint",
        "category" => "service",
        "statement" => "No me llegan las notificaciones."
      })

    {:ok, _} = Casework.claim(ctx.admin, harassment.id)

    assert ids(Casework.queue(ctx.admin, %{"kind" => "complaint"})) == [complaint.id]
    assert ids(Casework.queue(ctx.admin, %{"owner" => "me"})) == [harassment.id]

    assert Enum.sort(ids(Casework.queue(ctx.admin, %{"owner" => "none"}))) ==
             Enum.sort([minor.id, complaint.id])

    assert ids(Casework.queue(ctx.admin, %{"category" => "underage"})) == [minor.id]
    assert ids(Casework.queue(ctx.admin, %{"category" => "'; drop"})) |> length() == 3

    prefix = String.slice(minor.id, 0, 8)

    assert ids(
             Casework.queue(ctx.admin, %{"q" => " " <> String.upcase(prefix), "status" => "all"})
           ) == [minor.id]

    assert ids(Casework.queue(ctx.admin, %{"q" => minor.id, "status" => "all"})) == [minor.id]
    assert ids(Casework.queue(ctx.admin, %{"q" => "zz%", "status" => "all"})) == []
    assert ids(Casework.queue(ctx.privacy, %{"q" => prefix, "status" => "all"})) == []

    assert Casework.search_term("abc") == :invalid
    assert Casework.search_term("") == nil
    assert {:prefix, "613b"} = Casework.search_term("613B")

    {:ok, _} = Casework.resolve(ctx.admin, harassment.id, resolution("warning"))

    assert ids(Casework.queue(ctx.admin, %{"status" => "resolved", "owner" => "me"})) == [
             harassment.id
           ]

    assert ids(Casework.queue(ctx.staff, %{"status" => "resolved", "owner" => "me"})) == []

    assert {:ok, %{kinds: kinds, owners: owners}} = Casework.queue_counts(ctx.admin, %{})
    assert kinds == %{"report" => 1, "complaint" => 1}
    assert owners == %{all: 2, me: 0, none: 2}
  end

  test "overview counts each member's areas and hides team data from non-superusers", ctx do
    minor = report!(ctx.c, ctx.d, "underage")
    _other = report!(ctx.a, ctx.b, "spam")
    {:ok, _} = Casework.claim(ctx.staff, minor.id)

    assert {:ok, overview} = Casework.overview(ctx.staff)
    assert overview.counts.open == 2 and overview.counts.unassigned == 1
    assert overview.counts.mine == 1 and overview.counts.priority == 1
    assert [%Case{id: mine}] = overview.mine
    assert mine == minor.id
    assert overview.privacy == nil and overview.team == nil and overview.activity == []
    assert overview.measures == 0

    assert {:ok, %{counts: %{open: 0}, measures: nil, privacy: %{}}} =
             Casework.overview(ctx.privacy)

    assert {:ok, %{team: team, activity: activity}} = Casework.overview(ctx.owner)
    assert team.active == 5 and team.pending == 0
    refute Enum.any?(activity, &(&1.action in ~w(case_viewed staff_login)))
  end

  test "measures list current suspensions with their appeals, for moderation only", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, _} = Casework.resolve(ctx.staff, record.id, resolution("suspend"))
    subject = Repo.get!(Accounts.User, ctx.b.user_id)
    {:ok, appeal} = Casework.appeal(subject, record.id, %{"statement" => "Pido una revisión."})

    assert {:ok, %{measures: [measure], names: names}} = Casework.measures(ctx.other)
    assert measure.case_id == record.id and measure.display_name == ctx.b.display_name
    assert [%{id: appeal_id, status: "open"}] = measure.appeals
    assert appeal_id == appeal.id
    assert names[ctx.staff.id] == ctx.staff.email
    assert {:error, :forbidden} = Casework.measures(ctx.privacy)
  end

  test "activity log is for superusers, hides views by default and filters by group and person",
       ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.view(ctx.staff, record.id)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, _} = Casework.add_note(ctx.staff, record.id, "Comprobado el historial")

    assert {:error, :forbidden} = Casework.activity(ctx.admin)
    assert {:ok, %{entries: entries, people: people}} = Casework.activity(ctx.owner)
    refute Enum.any?(entries, &(&1.action == "case_viewed"))
    assert Enum.any?(people, &(&1.id == ctx.staff.id))

    assert {:ok, %{entries: [%Audit{action: "case_note_added"}]}} =
             Casework.activity(ctx.owner, %{"group" => "notes"})

    assert {:ok, %{entries: views}} = Casework.activity(ctx.owner, %{"group" => "views"})
    assert Enum.all?(views, &(&1.action == "case_viewed")) and views != []

    assert {:ok, %{entries: own, names: names}} =
             Casework.activity(ctx.owner, %{"group" => "all", "person" => ctx.staff.id})

    assert Enum.map(own, & &1.action) |> Enum.sort() ==
             ~w(case_assigned case_note_added case_viewed staff_provisioned)

    assert names[ctx.staff.id] == ctx.staff.email
  end

  test "closing other sessions keeps only the current one and is audited", ctx do
    {:ok, code} = Access.issue_login(ctx.staff.email)
    {:ok, %{token: current}} = Access.exchange(code)
    {:ok, code} = Access.issue_login(ctx.staff.email)
    {:ok, %{token: elsewhere}} = Access.exchange(code)

    assert %{count: 2, current: %{expires_at: _}} = Access.sessions(ctx.staff, current)
    assert {:error, :forbidden} = Access.revoke_other_sessions(ctx.staff, "unknown-token")
    assert {:ok, 1} = Access.revoke_other_sessions(ctx.staff, current)
    assert Access.authenticate(current)
    refute Access.authenticate(elsewhere)
    assert %{count: 1} = Access.sessions(ctx.staff, current)

    assert Repo.exists?(
             from(a in Audit,
               where:
                 a.action == "staff_sessions_revoked" and a.staff_id == ^ctx.staff.id and
                   fragment("?->>'count' = '1'", a.metadata)
             )
           )
  end

  test "decisions with unfilled template gaps are rejected", ctx do
    record = report!(ctx.a, ctx.b, "harassment")
    {:ok, _} = Casework.claim(ctx.staff, record.id)

    assert Case.template_gap?("Has incumplido [NORMA QUE SE APLICA].")
    refute Case.template_gap?("Tu cuenta [beta] sigue activa.")
    refute Case.template_gap?("Revisamos el [OK] de la app.")

    assert {:error, %Ecto.Changeset{errors: errors}} =
             Casework.resolve(ctx.staff, record.id, %{
               "outcome" => "warning",
               "response" => "Hemos comprobado que [HECHOS COMPROBADOS] incumplen las normas.",
               "reporter_response" => "Hemos revisado tu reporte y comunicado el resultado."
             })

    assert {_, _} = errors[:response]
    assert Repo.get!(Case, record.id).status == "open"
  end

  defp provision!(role) do
    {:ok, staff} = Access.provision(unique_email(role), role)
    staff
  end

  defp unique_email(prefix), do: "#{prefix}#{System.unique_integer([:positive])}@example.test"

  defp report!(from, to, reason) do
    {:ok, report} = Dating.Safety.report(from, to.id, reason, "Detalles solo para el equipo")
    Repo.get_by!(Case, report_id: report.id)
  end

  defp age!(record, seconds) do
    at = DateTime.utc_now() |> DateTime.add(-seconds) |> DateTime.truncate(:second)
    Repo.update_all(from(c in Case, where: c.id == ^record.id), set: [inserted_at: at])
  end

  defp ids({:ok, cases}), do: Enum.map(cases, & &1.id)

  defp resolution(outcome),
    do: %{
      "outcome" => outcome,
      "response" => "Decisión motivada para la persona afectada. Puedes recurrir en tu buzón.",
      "reporter_response" => "Hemos revisado tu reporte y comunicado el resultado necesario."
    }
end
