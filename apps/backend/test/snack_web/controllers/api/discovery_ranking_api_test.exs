defmodule SnackWeb.Controllers.Api.DiscoveryRankingApiTest do
  @moduledoc "HTTP surface of discovery ranking v2: preference validation, expandDistance, activity."
  use SnackWeb.ConnCase, async: false

  import Snack.TestSupport.DatingFixtures

  alias Snack.Dating
  alias Snack.Repo

  setup do
    user = user_fixture()
    profile = complete_profile_fixture(user)
    %{user: user, profile: profile, conn: authed_conn_for_user(user)}
  end

  describe "PUT /api/me/discovery-preferences (#22)" do
    test "rejects a distance outside the product options", %{conn: conn} do
      assert %{"errors" => %{"distance_km" => [message]}} =
               conn
               |> put("/api/me/discovery-preferences", %{"distance_km" => 30})
               |> json_response(422)

      assert message =~ "10, 25, 50, 100"
    end

    test "rejects age_min greater than age_max and ages outside 18..100", %{conn: conn} do
      assert %{"errors" => %{"age_max" => ["must be greater than or equal to age_min"]}} =
               conn
               |> put("/api/me/discovery-preferences", %{"age_min" => 40, "age_max" => 30})
               |> json_response(422)

      assert %{"errors" => %{"age_min" => [_]}} =
               conn
               |> put("/api/me/discovery-preferences", %{"age_min" => 17})
               |> json_response(422)
    end

    test "an invalid update leaves a complete profile complete", %{conn: conn, profile: profile} do
      conn |> put("/api/me/discovery-preferences", %{"distance_km" => 7}) |> json_response(422)

      assert Repo.get!(Dating.Profile, profile.id).is_complete
      assert Dating.get_discovery_preference(profile.id).distance_km == 25
    end

    test "stores and serialises expandDistance (default true)", %{conn: conn} do
      assert %{"discoveryPreferences" => %{"expandDistance" => true}} =
               conn |> get("/api/me/discovery-preferences") |> json_response(200)

      assert %{"discoveryPreferences" => %{"expandDistance" => false, "distanceKm" => 999_999}} =
               conn
               |> put("/api/me/discovery-preferences", %{
                 "expand_distance" => false,
                 "distance_km" => 999_999
               })
               |> json_response(200)

      assert %{"discoveryPreferences" => %{"expandDistance" => false}} =
               conn |> get("/api/me/discovery-preferences") |> json_response(200)
    end
  end

  describe "activity tracking" do
    test "an authenticated request marks the profile as active", %{conn: conn, profile: profile} do
      assert Repo.get!(Dating.Profile, profile.id).last_active_at == nil

      conn |> get("/api/me/profile") |> json_response(200)

      assert %DateTime{} = active_at = Repo.get!(Dating.Profile, profile.id).last_active_at
      assert DateTime.diff(DateTime.utc_now(), active_at) < 60
    end

    test "requests without a profile or without a session are unaffected" do
      user = user_fixture()
      assert user |> authed_conn_for_user() |> get("/api/bootstrap") |> json_response(200)
      assert build_conn() |> get("/api/me/profile") |> response(401)
    end
  end

  describe "GET /api/discovery/feed" do
    test "hides a candidate who disliked the viewer until they undo it", %{
      conn: conn,
      profile: viewer
    } do
      other_user = user_fixture()
      other = complete_profile_fixture(other_user)
      other_conn = authed_conn_for_user(other_user)

      assert %{"profiles" => [%{"id" => id}]} =
               conn |> get("/api/discovery/feed") |> json_response(200)

      assert id == other.id

      assert %{"matchCreated" => false} =
               other_conn
               |> post("/api/discovery/actions", %{
                 "target_profile_id" => viewer.id,
                 "action_type" => "dislike"
               })
               |> json_response(200)

      assert %{"profiles" => []} = conn |> get("/api/discovery/feed") |> json_response(200)

      assert %{"undone" => true} = other_conn |> post("/api/discovery/undo") |> json_response(200)

      assert %{"profiles" => [%{"id" => ^id}]} =
               conn |> get("/api/discovery/feed") |> json_response(200)
    end

    test "serves the v2 ranking through the API", %{conn: conn, profile: viewer} do
      candidate = complete_profile_fixture(user_fixture())

      {:ok, _} =
        Dating.record_swipe(%{
          actor_profile_id: candidate.id,
          target_profile_id: viewer.id,
          action_type: "like"
        })

      assert %{"profiles" => [%{"id" => id, "score" => score}], "nextCursor" => nil} =
               conn |> get("/api/discovery/feed") |> json_response(200)

      assert id == candidate.id

      # 45 tags (identical sets) + 10 intent + 12 reciprocity + 10 distance, plus 0..4 exploration.
      assert score >= 77 and score <= 81
    end
  end
end
