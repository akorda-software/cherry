defmodule SnackWeb.Controllers.Api.SafetySettingsBootstrapTest do
  use SnackWeb.ConnCase, async: false

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating
  alias Snack.Dating.Report
  alias Snack.Dating.UserBlock
  alias Snack.Repo

  setup do
    user = user_fixture()
    profile = complete_profile_fixture(user)
    other_user = user_fixture()
    other = complete_profile_fixture(other_user)

    %{
      profile: profile,
      other: other,
      conn: authed_conn_for_user(user),
      other_conn: authed_conn_for_user(other_user)
    }
  end

  describe "POST /api/users/:profile_id/block" do
    test "blocks idempotently and hides the match from both sides", ctx do
      {_match, conversation} = mutual_match!(ctx.profile, ctx.other)

      assert %{"ok" => true} =
               ctx.conn |> post("/api/users/#{ctx.other.id}/block") |> json_response(200)

      assert %{"ok" => true} =
               ctx.conn |> post("/api/users/#{ctx.other.id}/block") |> json_response(200)

      assert Repo.aggregate(UserBlock, :count) == 1

      for conn <- [ctx.conn, ctx.other_conn] do
        assert %{"matches" => []} = conn |> get("/api/matches") |> json_response(200)
        assert %{"conversations" => []} = conn |> get("/api/conversations") |> json_response(200)

        assert %{"error" => "conversation_not_active"} =
                 conn
                 |> get("/api/conversations/#{conversation.id}/messages")
                 |> json_response(403)
      end

      assert %{"error" => "profile_not_found"} =
               ctx.other_conn |> get("/api/profiles/#{ctx.profile.id}") |> json_response(404)
    end

    test "rejects self and unknown profiles", ctx do
      assert %{"error" => "cannot_block_self"} =
               ctx.conn |> post("/api/users/#{ctx.profile.id}/block") |> json_response(422)

      for id <- [Ecto.UUID.generate(), "nope"] do
        assert %{"error" => "profile_not_found"} =
                 ctx.conn |> post("/api/users/#{id}/block") |> json_response(404)
      end
    end
  end

  describe "POST /api/users/:profile_id/report" do
    test "stores a report with a known reason", ctx do
      assert %{"report" => report} =
               ctx.conn
               |> post("/api/users/#{ctx.other.id}/report", %{
                 "reason" => "harassment",
                 "details" => "  Mensajes insistentes  "
               })
               |> json_response(200)

      assert report["reason"] == "harassment"
      assert report["details"] == "Mensajes insistentes"
      assert report["status"] == "open"
      assert Repo.get!(Report, report["id"]).target_profile_id == ctx.other.id
    end

    test "accepts every documented reason", ctx do
      for reason <- Snack.Dating.Safety.report_reasons() do
        target = complete_profile_fixture(user_fixture())

        assert %{"report" => %{"reason" => ^reason, "details" => nil}} =
                 ctx.conn
                 |> post("/api/users/#{target.id}/report", %{"reason" => reason})
                 |> json_response(200)
      end
    end

    test "is idempotent while the previous report is open", ctx do
      path = "/api/users/#{ctx.other.id}/report"

      assert %{"report" => %{"id" => id, "reason" => "spam"}} =
               ctx.conn |> post(path, %{"reason" => "spam"}) |> json_response(200)

      assert %{"report" => %{"id" => ^id, "reason" => "spam"}} =
               ctx.conn |> post(path, %{"reason" => "harassment"}) |> json_response(200)

      assert Repo.aggregate(Report, :count) == 1

      # Once moderated, a new report can be filed.
      Repo.update_all(Report, set: [status: "reviewed"])

      assert %{"report" => %{"id" => new_id, "reason" => "harassment"}} =
               ctx.conn |> post(path, %{"reason" => "harassment"}) |> json_response(200)

      assert new_id != id
    end

    test "a deleted profile or account is indistinguishable from an unknown one", ctx do
      deleted_user = user_fixture()
      deleted = complete_profile_fixture(deleted_user)
      {:ok, _} = Snack.Accounts.delete_account(deleted_user)

      assert %{"error" => "profile_not_found"} =
               ctx.conn
               |> post("/api/users/#{deleted.id}/report", %{"reason" => "spam"})
               |> json_response(404)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> post("/api/users/#{deleted.id}/block") |> json_response(404)

      assert Repo.aggregate(Report, :count) == 0
    end

    test "validates reason, details, self and target", ctx do
      path = "/api/users/#{ctx.other.id}/report"

      for params <- [%{}, %{"reason" => "rude"}, %{"reason" => ""}] do
        assert %{"error" => "invalid_report_reason"} =
                 ctx.conn |> post(path, params) |> json_response(422)
      end

      assert %{"error" => "details_too_long"} =
               ctx.conn
               |> post(path, %{"reason" => "other", "details" => String.duplicate("a", 1001)})
               |> json_response(422)

      assert %{"error" => "cannot_report_self"} =
               ctx.conn
               |> post("/api/users/#{ctx.profile.id}/report", %{"reason" => "spam"})
               |> json_response(422)

      assert %{"error" => "profile_not_found"} =
               ctx.conn
               |> post("/api/users/#{Ecto.UUID.generate()}/report", %{"reason" => "spam"})
               |> json_response(404)

      assert Repo.aggregate(Report, :count) == 0
    end
  end

  describe "settings" do
    test "pause hides the profile and unpause restores it", ctx do
      assert %{"ok" => true} = ctx.conn |> post("/api/me/pause") |> json_response(200)
      paused = Repo.get!(Dating.Profile, ctx.profile.id)
      assert paused.is_paused
      refute paused.is_discoverable

      assert %{"profile" => %{"isPaused" => true, "isDiscoverable" => false}} =
               ctx.conn |> get("/api/bootstrap") |> json_response(200)

      assert %{"profiles" => []} =
               ctx.other_conn |> get("/api/discovery/feed") |> json_response(200)

      assert %{"ok" => true} = ctx.conn |> post("/api/me/unpause") |> json_response(200)
      resumed = Repo.get!(Dating.Profile, ctx.profile.id)
      refute resumed.is_paused
      assert resumed.is_discoverable
    end

    test "pause keeps existing matches", ctx do
      {match, _conversation} = mutual_match!(ctx.profile, ctx.other)
      assert %{"ok" => true} = ctx.conn |> post("/api/me/pause") |> json_response(200)

      assert %{"matches" => [%{"id" => id}]} =
               ctx.other_conn |> get("/api/matches") |> json_response(200)

      assert id == match.id
    end

    test "settings endpoints need a profile except account deletion" do
      conn = authed_conn_for_user(user_fixture())

      for path <- ["/api/me/pause", "/api/me/unpause"] do
        assert %{"error" => "profile_not_found"} = conn |> post(path) |> json_response(404)
      end

      assert %{"ok" => true} = conn |> delete("/api/me/account") |> json_response(200)
    end

    test "deleting the account hides the person from their matches", ctx do
      mutual_match!(ctx.profile, ctx.other)
      assert %{"ok" => true} = ctx.conn |> delete("/api/me/account") |> json_response(200)
      assert %{"matches" => []} = ctx.other_conn |> get("/api/matches") |> json_response(200)
    end
  end

  describe "GET /api/bootstrap" do
    test "without profile the onboarding starts by the name" do
      user = user_fixture(%{display_name: "Nueva"})

      assert %{
               "user" => %{"id" => id, "displayName" => "Nueva"},
               "profile" => %{
                 "exists" => false,
                 "isComplete" => false,
                 "onboardingRequired" => true,
                 "nextOnboardingStep" => "name"
               }
             } = user |> authed_conn_for_user() |> get("/api/bootstrap") |> json_response(200)

      assert id == user.id
    end

    test "a draft profile points to its first missing step" do
      user = user_fixture()

      {:ok, _draft} =
        Dating.upsert_profile_for_user(user.id, %{
          "display_name" => "Borrador",
          "birth_date" => "1995-01-15",
          "gender" => "woman"
        })

      assert %{
               "profile" => %{
                 "exists" => true,
                 "isComplete" => false,
                 "onboardingRequired" => true,
                 "nextOnboardingStep" => "intent"
               }
             } = user |> authed_conn_for_user() |> get("/api/bootstrap") |> json_response(200)
    end

    test "a complete profile goes straight to the app", ctx do
      assert %{
               "profile" => %{
                 "exists" => true,
                 "isComplete" => true,
                 "isDiscoverable" => true,
                 "isPaused" => false,
                 "onboardingRequired" => false,
                 "nextOnboardingStep" => nil
               }
             } = ctx.conn |> get("/api/bootstrap") |> json_response(200)
    end

    test "requires authentication" do
      assert build_conn() |> get("/api/bootstrap") |> response(401)
    end
  end
end
