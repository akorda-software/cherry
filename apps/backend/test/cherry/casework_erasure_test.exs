defmodule Cherry.CaseworkErasureTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.{Accounts, Casework, Dating}
  alias Cherry.Backoffice.Access
  alias Cherry.Casework.{Audit, Case, Notice}

  setup do
    reporter = user_fixture()
    subject = user_fixture()
    a = profile_fixture(reporter)
    b = profile_fixture(subject)

    {:ok, decider} =
      Access.provision("decider-#{System.unique_integer([:positive])}@example.test", "moderator")

    {:ok, reviewer} =
      Access.provision("reviewer-#{System.unique_integer([:positive])}@example.test", "moderator")

    {:ok, privacy} =
      Access.provision("privacy-#{System.unique_integer([:positive])}@example.test", "privacy")

    marker = "ERASED_NARRATIVE_#{reporter.id}_#{reporter.email}"
    {:ok, report} = Dating.Safety.report(a, b.id, "harassment", marker)
    record = Repo.get_by!(Case, report_id: report.id)
    {:ok, _} = Casework.claim(decider, record.id)

    {:ok, _} =
      Casework.resolve(decider, record.id, %{
        "outcome" => "suspend",
        "response" => marker,
        "reporter_response" => marker
      })

    %{
      reporter: reporter,
      subject: subject,
      a: a,
      b: b,
      report: report,
      record: record,
      decider: decider,
      reviewer: reviewer,
      privacy: privacy,
      marker: marker
    }
  end

  test "erases the original graph but keeps only the other account's minimal measure and independent appeal",
       ctx do
    suspended = Repo.get!(Accounts.User, ctx.subject.id)
    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    current = Repo.get!(Accounts.User, ctx.subject.id)
    assert current.suspended_at == suspended.suspended_at
    refute Repo.get!(Dating.Profile, ctx.b.id).is_discoverable
    refute Repo.get(Accounts.User, ctx.reporter.id)
    refute Repo.get(Case, ctx.record.id)
    refute Repo.get(Dating.Report, ctx.report.id)
    assert [measure] = Repo.all(Case)
    assert current.suspension_case_id == measure.id
    assert measure.kind == "measure"
    assert measure.outcome == "suspend"
    assert measure.status == "resolved"
    assert measure.decided_by_staff_id == ctx.decider.id
    assert measure.resolved_at == Repo.get!(Accounts.User, ctx.subject.id).suspended_at

    for field <-
          ~w(requester_user_id report_id parent_case_id statement reporter_response assigned_staff_id)a do
      assert is_nil(Map.fetch!(measure, field))
    end

    assert Casework.list_for_user(ctx.subject) |> Enum.map(& &1.id) == [measure.id]
    assert {:error, :not_found} = Casework.get_for_user(user_fixture(), measure.id)
    assert {:error, :forbidden} = Casework.view(ctx.privacy, measure.id)
    assert {:ok, _} = Casework.view(ctx.reviewer, measure.id)
    assert {:error, :already_resolved} = Casework.claim(ctx.reviewer, measure.id)
    assert_minimal(ctx)

    {:ok, review} =
      Casework.appeal(ctx.subject, measure.id, %{
        "statement" => "Solicito que reviséis esta suspensión."
      })

    assert {:error, :independent_reviewer_required} = Casework.claim(ctx.decider, review.id)
    assert {:ok, _} = Casework.claim(ctx.reviewer, review.id)

    assert {:ok, _} =
             Casework.resolve(ctx.reviewer, review.id, %{
               "outcome" => "overturned",
               "response" => "Tras revisión humana revocamos la suspensión vigente."
             })

    refute Repo.get!(Accounts.User, ctx.subject.id).suspended_at
    assert {:ok, :deleted} = Accounts.delete_account(ctx.subject)
    assert Repo.aggregate(Case, :count) == 0
    assert Repo.aggregate(Notice, :count) == 0
    refute Repo.exists?(from(e in Audit, where: not is_nil(e.case_id) or not is_nil(e.user_id)))
  end

  test "a pending appeal remains pending and assigned, without its old statement or duplicate rights",
       ctx do
    {:ok, appeal} = Casework.appeal(ctx.subject, ctx.record.id, %{"statement" => ctx.marker})
    {:ok, _} = Casework.claim(ctx.reviewer, appeal.id)
    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    measure = Repo.get!(Case, Repo.get!(Accounts.User, ctx.subject.id).suspension_case_id)
    replacement = Repo.get_by!(Case, kind: "appeal", parent_case_id: measure.id)
    assert replacement.id != appeal.id
    assert replacement.status == "open"
    assert replacement.assigned_staff_id == ctx.reviewer.id
    assert replacement.inserted_at == appeal.inserted_at
    refute Repo.get(Case, appeal.id)

    assert {:error, :already_appealed} =
             Casework.appeal(ctx.subject, measure.id, %{
               "statement" => "No crear otro recurso duplicado."
             })

    assert_minimal(ctx)

    assert {:ok, _} =
             Casework.resolve(ctx.reviewer, replacement.id, %{
               "outcome" => "overturned",
               "response" => "Estimada la solicitud por revisión humana de la medida."
             })

    refute Repo.get!(Accounts.User, ctx.subject.id).suspended_at
  end

  test "a completed human review keeps only its outcome, date and independent decision maker",
       ctx do
    {:ok, appeal} = Casework.appeal(ctx.subject, ctx.record.id, %{"statement" => ctx.marker})
    {:ok, _} = Casework.claim(ctx.reviewer, appeal.id)

    {:ok, appeal} =
      Casework.resolve(ctx.reviewer, appeal.id, %{"outcome" => "upheld", "response" => ctx.marker})

    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    measure = Repo.get!(Case, Repo.get!(Accounts.User, ctx.subject.id).suspension_case_id)
    review = Repo.get_by!(Case, kind: "appeal", parent_case_id: measure.id)
    assert review.status == "resolved"
    assert review.outcome == "upheld"
    assert review.resolved_at == appeal.resolved_at
    assert review.decided_by_staff_id == ctx.reviewer.id

    assert {:error, :already_appealed} =
             Casework.appeal(ctx.subject, measure.id, %{
               "statement" => "No reiniciar una revisión ya resuelta."
             })

    assert_minimal(ctx)
    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    assert Repo.aggregate(Case, :count) == 2
  end

  test "an unrelated account deletion neither duplicates a measure nor resets a previous restoration",
       ctx do
    {:ok, appeal} =
      Casework.appeal(ctx.subject, ctx.record.id, %{
        "statement" => "Solicito revisión de esta medida."
      })

    {:ok, _} = Casework.claim(ctx.reviewer, appeal.id)

    {:ok, _} =
      Casework.resolve(ctx.reviewer, appeal.id, %{
        "outcome" => "overturned",
        "response" => "Revisión favorable, se revoca la suspensión de la cuenta."
      })

    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    refute Repo.get!(Accounts.User, ctx.subject.id).suspended_at
    assert Repo.aggregate(Case, :count) == 0
  end

  test "deleting the affected account leaves no minimal blacklist or measure", ctx do
    assert {:ok, :deleted} = Accounts.delete_account(ctx.subject)
    assert Repo.get(Accounts.User, ctx.reporter.id)
    assert Repo.aggregate(Case, :count) == 0
    assert Repo.aggregate(Notice, :count) == 0
  end

  test "a later failed step rolls back both erasure and minimal-measure transfer", ctx do
    assert {:error, :rollback} =
             Repo.transaction(fn ->
               assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
               Repo.rollback(:rollback)
             end)

    assert Repo.get(Accounts.User, ctx.reporter.id)
    assert Repo.get(Case, ctx.record.id)
    assert Repo.get!(Accounts.User, ctx.subject.id).suspension_case_id == ctx.record.id
    refute Repo.exists?(from(c in Case, where: c.kind == "measure"))
  end

  test "a live suspension on a descendant is retained even without a direct link to the erased account",
       ctx do
    parent =
      Repo.insert!(%Case{
        kind: "complaint",
        category: "safety",
        requester_user_id: ctx.reporter.id,
        statement: ctx.marker
      })

    Repo.get!(Case, ctx.record.id)
    |> Ecto.Changeset.change(requester_user_id: nil, parent_case_id: parent.id)
    |> Repo.update!()

    assert {:ok, :deleted} = Accounts.delete_account(ctx.reporter)
    assert [measure] = Repo.all(Case)
    assert measure.kind == "measure"
    assert Repo.get!(Accounts.User, ctx.subject.id).suspension_case_id == measure.id
    assert_minimal(ctx)
  end

  defp assert_minimal(ctx) do
    for table <- ~w(casework_cases casework_notices casework_audit reports) do
      %{rows: rows} = Repo.query!("SELECT to_jsonb(t)::text FROM #{table} t", [], log: false)
      text = rows |> List.flatten() |> Enum.join(" ")

      for sensitive <- [
            ctx.marker,
            ctx.reporter.id,
            ctx.reporter.email,
            ctx.record.id,
            ctx.report.id
          ] do
        refute text =~ sensitive
      end
    end
  end
end
