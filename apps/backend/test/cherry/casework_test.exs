defmodule Cherry.CaseworkTest do
  use Cherry.DataCase, async: false
  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures
  alias Cherry.Backoffice.Access
  alias Cherry.Casework
  alias Cherry.Casework.{Audit, Case, Notice}
  alias Cherry.Dating
  alias Cherry.Dating.{Profile, Report}

  setup do
    reporter = user_fixture()
    target = user_fixture()
    a = complete_profile_fixture(reporter)
    b = complete_profile_fixture(target)

    {:ok, staff} =
      Access.provision("moderator#{System.unique_integer([:positive])}@example.test", "moderator")

    {:ok, privacy} =
      Access.provision("privacy#{System.unique_integer([:positive])}@example.test", "privacy")

    {:ok, admin} =
      Access.provision("admin#{System.unique_integer([:positive])}@example.test", "admin")

    %{
      reporter: reporter,
      target: target,
      a: a,
      b: b,
      staff: staff,
      privacy: privacy,
      admin: admin
    }
  end

  test "report and case are created atomically and deduplicated", ctx do
    {:ok, report} =
      Dating.Safety.report(ctx.a, ctx.b.id, "harassment", "Details only for reviewers")

    {:ok, again} = Dating.Safety.report(ctx.a, ctx.b.id, "spam", nil)
    assert report.id == again.id
    assert [record] = Repo.all(Case)
    assert record.report_id == report.id
    assert record.requester_user_id == ctx.reporter.id
    assert record.subject_user_id == ctx.target.id
    assert [%Notice{event: "received"}] = Casework.notices(ctx.reporter)
    assert [] == Casework.list_for_user(ctx.target)
    assert [] == Casework.notices(ctx.target)
  end

  test "privacy roles cannot access moderation and vice versa, even with forged role", ctx do
    record = report!(ctx)

    {:ok, private} =
      Casework.submit(ctx.reporter, %{
        "kind" => "privacy",
        "category" => "access",
        "statement" => "Quiero acceder a mis datos."
      })

    assert {:ok, [^record]} = Casework.queue(ctx.staff)
    assert {:ok, [^private]} = Casework.queue(ctx.privacy)
    assert {:error, :forbidden} = Casework.view(%{ctx.staff | role: "admin"}, private.id)
    assert {:error, :forbidden} = Casework.view(ctx.privacy, record.id)

    assert {:ok, %{case: ^record, profile: %{bio: _}, events: events}} =
             Casework.view(ctx.staff, record.id)

    assert Enum.any?(events, &(&1.action == "case_viewed"))
    refute Enum.any?(events, &(map_size(&1.metadata) > 0))
  end

  test "claim, validate, decide once and deliver distinct private messages", ctx do
    record = report!(ctx)

    assert {:error, :claim_required} =
             Casework.resolve(ctx.staff, record.id, resolution("warning"))

    assert {:ok, _} = Casework.claim(ctx.staff, record.id)
    assert {:error, :assigned_elsewhere} = Casework.claim(ctx.admin, record.id)

    assert {:error, %Ecto.Changeset{}} =
             Casework.resolve(ctx.staff, record.id, %{
               "outcome" => "warning",
               "response" => "short"
             })

    assert {:ok, decided} = Casework.resolve(ctx.staff, record.id, resolution("warning"))
    assert decided.status == "resolved"
    assert Repo.get!(Report, record.report_id).status == "actioned"

    assert {:error, :already_resolved} =
             Casework.resolve(ctx.staff, record.id, resolution("suspend"))

    assert Enum.count(Casework.notices(ctx.reporter), &(&1.event == "resolved")) == 1
    assert [target_notice] = Casework.notices(ctx.target)
    assert target_notice.message == resolution("warning")["response"]
    assert target_notice.message != resolution("warning")["reporter_response"]
    assert Enum.count(Repo.all(Audit), &(&1.action == "case_resolved")) == 1
    refute inspect(Repo.all(Audit)) =~ "Details only for reviewers"
  end

  test "dismissal does not expose the accusation to the target", ctx do
    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, _} = Casework.resolve(ctx.staff, record.id, resolution("dismissed"))
    assert [] == Casework.list_for_user(ctx.target)
    assert [] == Casework.notices(ctx.target)

    assert {:error, :not_found} =
             Casework.appeal(ctx.target, record.id, %{
               "statement" => "Intento acceder a un caso ajeno."
             })
  end

  test "suspension hides social data; independent appeal restores without deleting anything",
       ctx do
    {_match, conversation} = mutual_match!(ctx.a, ctx.b)
    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    assert {:ok, _} = Casework.resolve(ctx.staff, record.id, resolution("suspend"))
    assert Repo.get!(Cherry.Accounts.User, ctx.target.id).suspended_at
    assert Repo.get!(Profile, ctx.b.id).deleted_at == nil
    refute Dating.conversation_allows_messaging?(conversation.id, ctx.a.id)

    assert {:error, :profile_not_found} =
             Dating.Social.PublicProfiles.public_profile(ctx.a, ctx.b.id)

    # Neither completing nor unpausing an already-held profile bypasses suspension.
    assert {:ok, profile} = Dating.set_profile_complete(ctx.b)
    refute profile.is_discoverable

    {:ok, appeal} =
      Casework.appeal(ctx.target, record.id, %{
        "statement" => "Solicito una revisión humana de la suspensión."
      })

    assert {:error, :already_appealed} =
             Casework.appeal(ctx.target, record.id, %{"statement" => "Recurso duplicado."})

    assert {:error, :independent_reviewer_required} = Casework.claim(ctx.staff, appeal.id)
    {:ok, _} = Casework.claim(ctx.admin, appeal.id)
    assert {:ok, _} = Casework.resolve(ctx.admin, appeal.id, resolution("overturned"))
    refute Repo.get!(Cherry.Accounts.User, ctx.target.id).suspended_at
    assert Dating.conversation_allows_messaging?(conversation.id, ctx.a.id)
    assert Repo.get!(Profile, ctx.b.id).is_discoverable
  end

  test "overturn does not restore a deleted account or a changed measure", ctx do
    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, _} = Casework.resolve(ctx.staff, record.id, resolution("suspend"))

    {:ok, appeal} =
      Casework.appeal(ctx.target, record.id, %{"statement" => "Solicito revisar esta medida."})

    {:ok, _} = Casework.claim(ctx.admin, appeal.id)

    Repo.get!(Cherry.Accounts.User, ctx.target.id)
    |> Ecto.Changeset.change(suspension_case_id: nil)
    |> Repo.update!()

    assert {:error, :measure_changed} =
             Casework.resolve(ctx.admin, appeal.id, resolution("overturned"))

    assert Repo.get!(Case, appeal.id).status == "open"
  end

  test "intake validates categories and ignores all client supplied authorities", ctx do
    assert {:error, %Ecto.Changeset{}} =
             Casework.submit(ctx.reporter, %{
               "kind" => "report",
               "category" => "access",
               "statement" => "No puedo fabricar un reporte."
             })

    assert {:error, %Ecto.Changeset{}} =
             Casework.submit(ctx.reporter, %{
               "kind" => "privacy",
               "category" => "unknown",
               "statement" => String.duplicate("a", 4001)
             })

    {:ok, record} =
      Casework.submit(ctx.reporter, %{
        "kind" => "privacy",
        "category" => "erasure",
        "statement" => "Solicito la supresión de mis datos.",
        "requester_user_id" => ctx.target.id,
        "status" => "resolved",
        "assigned_staff_id" => ctx.staff.id
      })

    assert record.requester_user_id == ctx.reporter.id
    assert record.status == "open"
    refute record.assigned_staff_id
    assert {:error, :not_found} = Casework.get_for_user(ctx.target, record.id)
    assert {:error, :not_found} = Casework.get_for_user(ctx.reporter, "invalid")
    assert [notice] = Casework.notices(ctx.reporter)
    assert {:error, :not_found} = Casework.read_notice(ctx.target, notice.id)
    assert {:ok, :read} = Casework.read_notice(ctx.reporter, notice.id)
  end

  test "ten requests a day and bounded pagination", ctx do
    for _ <- 1..10 do
      assert {:ok, _} =
               Casework.submit(ctx.reporter, %{
                 "kind" => "complaint",
                 "category" => "service",
                 "statement" => "Necesito ayuda con el servicio."
               })
    end

    assert {:error, :rate_limited} =
             Casework.submit(ctx.reporter, %{
               "kind" => "complaint",
               "category" => "service",
               "statement" => "Otra solicitud de servicio."
             })

    assert Casework.offset(%{"offset" => "900000"}) == 0
    assert length(Casework.list_for_user(ctx.reporter, 5)) == 5
  end

  test "disable immediately denies even a previously fetched staff struct", ctx do
    record = report!(ctx)
    assert {:ok, :ok} = Access.disable(ctx.staff.email)
    assert {:error, :forbidden} = Casework.queue(ctx.staff)
    assert {:error, :forbidden} = Casework.claim(ctx.staff, record.id)
  end

  defp report!(ctx) do
    {:ok, report} =
      Dating.Safety.report(ctx.a, ctx.b.id, "harassment", "Details only for reviewers")

    Repo.get_by!(Case, report_id: report.id)
  end

  test "only an admin can recover a case assigned to disabled staff", ctx do
    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, :ok} = Access.disable(ctx.staff.email)
    assert {:error, :forbidden} = Casework.reassign(ctx.privacy, record.id)
    assert {:ok, reassigned} = Casework.reassign(ctx.admin, record.id)
    assert reassigned.assigned_staff_id == ctx.admin.id
    assert {:ok, _} = Casework.resolve(ctx.admin, record.id, resolution("dismissed"))
  end

  test "a successful reporter appeal opens a fresh independent review without rewriting history",
       ctx do
    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)
    {:ok, original} = Casework.resolve(ctx.staff, record.id, resolution("dismissed"))

    {:ok, appeal} =
      Casework.appeal(ctx.reporter, original.id, %{
        "statement" => "Solicito revisar la decisión con los hechos aportados."
      })

    {:ok, _} = Casework.claim(ctx.admin, appeal.id)
    assert {:ok, _} = Casework.resolve(ctx.admin, appeal.id, resolution("overturned"))
    assert Repo.get!(Case, original.id) == original

    assert [followup] =
             Repo.all(
               from(c in Case, where: c.parent_case_id == ^original.id and c.kind == "report")
             )

    assert followup.status == "open"
    assert {:error, :independent_reviewer_required} = Casework.claim(ctx.staff, followup.id)
    refute Repo.get!(Cherry.Accounts.User, ctx.target.id).suspended_at
    assert [] == Casework.notices(ctx.target)
  end

  defp resolution(outcome),
    do: %{
      "outcome" => outcome,
      "response" => "Decisión motivada para la persona afectada. Puedes recurrir en tu buzón.",
      "reporter_response" => "Hemos revisado tu reporte y comunicado el resultado necesario."
    }

  test "SQL debug logging does not copy statements or decision messages", ctx do
    require Logger
    level = Logger.level()
    Logger.configure(level: :debug)
    on_exit(fn -> Logger.configure(level: level) end)

    logs =
      ExUnit.CaptureLog.capture_log([level: :debug], fn ->
        Logger.debug("casework-log-capture-active")

        {:ok, report} =
          Dating.Safety.report(ctx.a, ctx.b.id, "harassment", "PRIVATE_REPORT_TEXT_ONLY")

        record = Repo.get_by!(Case, report_id: report.id)
        {:ok, _} = Casework.claim(ctx.staff, record.id)

        assert {:ok, _} =
                 Casework.resolve(ctx.staff, record.id, %{
                   "outcome" => "warning",
                   "response" => "PRIVATE_SUBJECT_RESPONSE_ONLY with enough length",
                   "reporter_response" => "PRIVATE_REPORTER_RESPONSE_ONLY with enough length"
                 })

        assert {:ok, _} =
                 Casework.submit(ctx.reporter, %{
                   "kind" => "privacy",
                   "category" => "access",
                   "statement" => "PRIVATE_PRIVACY_REQUEST_ONLY"
                 })
      end)

    assert logs =~ "casework-log-capture-active"

    for text <-
          ~w(PRIVATE_REPORT_TEXT_ONLY PRIVATE_SUBJECT_RESPONSE_ONLY PRIVATE_REPORTER_RESPONSE_ONLY PRIVATE_PRIVACY_REQUEST_ONLY),
        do: refute(logs =~ text)
  end

  test "estimating a service complaint appeal reopens work rather than only sending a message",
       ctx do
    {:ok, original} =
      Casework.submit(ctx.reporter, %{
        "kind" => "complaint",
        "category" => "service",
        "statement" => "Necesito resolver esta incidencia del servicio."
      })

    {:ok, _} = Casework.claim(ctx.staff, original.id)
    {:ok, original} = Casework.resolve(ctx.staff, original.id, resolution("refused"))

    {:ok, appeal} =
      Casework.appeal(ctx.reporter, original.id, %{
        "statement" => "La respuesta no atiende el problema. Solicito revisión."
      })

    {:ok, _} = Casework.claim(ctx.admin, appeal.id)
    assert {:ok, _} = Casework.resolve(ctx.admin, appeal.id, resolution("overturned"))
    assert Repo.get!(Case, original.id) == original

    assert [%Case{kind: "complaint", status: "open"} = followup] =
             Repo.all(
               from(c in Case, where: c.parent_case_id == ^original.id and c.kind == "complaint")
             )

    assert {:error, :independent_reviewer_required} = Casework.claim(ctx.staff, followup.id)
  end

  test "malformed client values do not crash intake or resolution", ctx do
    for invalid <- [nil, [], %{}, 42, true] do
      assert {:error, %Ecto.Changeset{}} =
               Casework.submit(ctx.reporter, %{
                 "kind" => "privacy",
                 "category" => "access",
                 "statement" => invalid
               })
    end

    record = report!(ctx)
    {:ok, _} = Casework.claim(ctx.staff, record.id)

    assert {:error, %Ecto.Changeset{}} =
             Casework.resolve(ctx.staff, record.id, %{
               "outcome" => %{},
               "response" => [],
               "reporter_response" => true
             })

    assert Repo.get!(Case, record.id).status == "open"
  end

  test "reading a notice repeatedly preserves its first read timestamp", ctx do
    {:ok, _} =
      Casework.submit(ctx.reporter, %{
        "kind" => "privacy",
        "category" => "access",
        "statement" => "Solicito acceso a mis datos personales."
      })

    [notice] = Casework.notices(ctx.reporter)
    first = ~U[2026-10-01 12:00:00Z]
    notice |> Ecto.Changeset.change(read_at: first) |> Repo.update!()
    assert {:ok, :read} = Casework.read_notice(ctx.reporter, notice.id)
    assert Repo.get!(Notice, notice.id).read_at == first
    assert length(Casework.list_for_user(ctx.reporter, -50)) == 1
  end
end
