defmodule CherryWeb.Controllers.Api.CaseworkControllerTest do
  use CherryWeb.ConnCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Backoffice.Access
  alias Cherry.Casework
  alias Cherry.Casework.Case
  alias Cherry.Repo

  test "requires authentication even for an existing case", %{conn: conn} do
    assert conn |> get("/api/me/cases") |> json_response(401) == %{"error" => "unauthorized"}
  end

  test "after reporter erasure, the suspended account can read and appeal only its minimal measure" do
    reporter = user_fixture()
    subject = user_fixture()
    a = profile_fixture(reporter)
    b = profile_fixture(subject)
    subject_conn = authed_conn_for_user(subject)
    outsider = authed_conn_for_user(user_fixture())
    {:ok, report} = Cherry.Dating.Safety.report(a, b.id, "harassment", "SECRET_ERASED_REPORTER")
    original = Repo.get_by!(Case, report_id: report.id)

    {:ok, decider} =
      Access.provision(
        "api-decider-#{System.unique_integer([:positive])}@example.test",
        "moderator"
      )

    {:ok, reviewer} =
      Access.provision(
        "api-reviewer-#{System.unique_integer([:positive])}@example.test",
        "moderator"
      )

    {:ok, _} = Casework.claim(decider, original.id)

    {:ok, _} =
      Casework.resolve(decider, original.id, %{
        "outcome" => "suspend",
        "response" => "SECRET_ERASED_REPORTER in an old decision.",
        "reporter_response" => "SECRET_ERASED_REPORTER in an old notice."
      })

    assert {:ok, :deleted} = Cherry.Accounts.delete_account(reporter)
    result = subject_conn |> get("/api/me/cases") |> json_response(200)

    assert %{
             "cases" => [
               %{"id" => id, "kind" => "measure", "statement" => nil, "canAppeal" => true}
             ]
           } = result

    for sensitive <- [
          reporter.id,
          reporter.email,
          decider.id,
          original.id,
          "SECRET_ERASED_REPORTER"
        ] do
      refute Jason.encode!(result) =~ sensitive
    end

    assert subject_conn |> get("/api/me/cases/#{original.id}") |> json_response(404)
    assert outsider |> get("/api/me/cases/#{id}") |> json_response(404)

    assert subject_conn
           |> get("/api/me/cases/#{id}")
           |> json_response(200)
           |> get_in(["case", "canAppeal"])

    assert %{"case" => %{"id" => appeal_id}} =
             subject_conn
             |> post("/api/me/cases/#{id}/appeal", %{
               "statement" => "Solicito revisar la suspensión de mi cuenta."
             })
             |> json_response(201)

    assert subject_conn
           |> get("/api/me/cases/#{id}")
           |> json_response(200)
           |> get_in(["case", "canAppeal"]) == false

    assert {:error, :independent_reviewer_required} = Casework.claim(decider, appeal_id)
    assert {:ok, _} = Casework.claim(reviewer, appeal_id)

    assert {:ok, _} =
             Casework.resolve(reviewer, appeal_id, %{
               "outcome" => "overturned",
               "response" => "La revisión humana revoca esta suspensión."
             })

    refute Repo.get!(Cherry.Accounts.User, subject.id).suspended_at
    assert subject_conn |> get("/api/me/notices") |> json_response(200)
  end

  test "create, list, read receipt and reject cross-account access", _ do
    user = user_fixture()
    conn = authed_conn_for_user(user)
    other = authed_conn_for_user(user_fixture())

    created =
      conn
      |> post("/api/me/cases", %{
        "kind" => "privacy",
        "category" => "erasure",
        "statement" => "Quiero ejercer el derecho de supresión."
      })

    assert get_resp_header(created, "cache-control") == ["no-store"]
    assert %{"case" => %{"id" => id, "status" => "open"}} = json_response(created, 201)
    assert %{"cases" => [%{"id" => ^id}]} = conn |> get("/api/me/cases") |> json_response(200)

    for bad_id <- [id, "not-uuid", Ecto.UUID.generate()] do
      assert other |> get("/api/me/cases/#{bad_id}") |> json_response(404) == %{
               "error" => "case_not_found"
             }
    end

    assert %{"notices" => [%{"id" => notice_id}]} =
             conn |> get("/api/me/notices") |> json_response(200)

    assert other |> post("/api/me/notices/#{notice_id}/read") |> json_response(404)

    assert conn |> post("/api/me/notices/#{notice_id}/read") |> json_response(200) == %{
             "ok" => true
           }

    assert conn |> get("/api/me/cases?offset[bad]=value") |> json_response(200)
  end

  test "subject never sees reporter identity or statement; suspended users retain rights", _ do
    reporter = user_fixture()
    subject = user_fixture()
    a = complete_profile_fixture(reporter)
    b = complete_profile_fixture(subject)
    reporter_conn = authed_conn_for_user(reporter)
    subject_conn = authed_conn_for_user(subject)
    {:ok, report} = Cherry.Dating.Safety.report(a, b.id, "harassment", "SECRET_REPORTER_DETAILS")
    record = Repo.get_by!(Case, report_id: report.id)

    {:ok, staff} =
      Access.provision("staff#{System.unique_integer([:positive])}@example.test", "admin")

    {:ok, _} = Casework.claim(staff, record.id)

    {:ok, _} =
      Casework.resolve(staff, record.id, %{
        "outcome" => "suspend",
        "response" => "Tu cuenta está suspendida por una infracción acreditada. Puedes recurrir.",
        "reporter_response" => "Resultado para el reportero sin datos de la otra persona."
      })

    result = subject_conn |> get("/api/me/cases/#{record.id}") |> json_response(200)
    assert result["case"]["statement"] == nil
    refute Jason.encode!(result) =~ "SECRET_REPORTER_DETAILS"
    refute Jason.encode!(result) =~ reporter.id
    refute Jason.encode!(result) =~ staff.id

    assert reporter_conn
           |> get("/api/me/cases/#{record.id}")
           |> json_response(200)
           |> get_in(["case", "response"]) =~ "Resultado para el reportero"

    assert subject_conn |> get("/api/discovery/feed") |> json_response(403) == %{
             "error" => "account_suspended"
           }

    assert subject_conn
           |> post("/api/me/cases/#{record.id}/appeal", %{
             "statement" => "Solicito revisión de la decisión de suspensión."
           })
           |> json_response(201)

    assert subject_conn
           |> post("/api/me/cases", %{
             "kind" => "privacy",
             "category" => "access",
             "statement" => "Solicito acceder a mis datos personales."
           })
           |> json_response(201)

    assert subject_conn
           |> get("/api/me/cases/#{record.id}")
           |> json_response(200)
           |> get_in(["case", "canAppeal"]) == false

    assert subject_conn |> get("/api/me/summary") |> json_response(200) == %{
             "receivedLikesCount" => 0,
             "newMatchesCount" => 0,
             "unreadConversationsCount" => 0
           }

    # The owner explicitly chose erasure without a residual identity blacklist,
    # including when a suspended person exercises deletion.
    {:ok, _} = Cherry.Accounts.delete_account(Repo.get!(Cherry.Accounts.User, subject.id))
    refute Repo.get(Cherry.Accounts.User, subject.id)
    refute Repo.get(Case, record.id)
  end
end
