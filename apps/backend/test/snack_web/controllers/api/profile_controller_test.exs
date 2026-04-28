defmodule SnackWeb.Controllers.Api.ProfileControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Repo
  alias Snack.Sessions

  setup do
    {:ok, user} =
      Accounts.create_user(%{email: "profile_ctrl@example.com", display_name: "Profile Ctrl"})

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: "Test User",
        birth_date: ~D[1995-01-15],
        gender: "man",
        what_i_am_looking_for: "relationship",
        bio: "This is a test bio that is long enough to pass validation rules."
      })

    {:ok, issued} =
      Sessions.issue_session(user, %{
        installation_id: "profile-ctrl-install",
        platform: "ios",
        device_name: "Test Device"
      })

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{user: user, profile: profile, authed_conn: authed_conn}
  end

  describe "GET /api/me/profile" do
    test "returns the current profile", %{authed_conn: conn, profile: profile} do
      conn = get(conn, "/api/me/profile")
      assert %{"profile" => %{"id" => id}} = json_response(conn, 200)
      assert id == profile.id
    end

    test "returns 404 without auth", %{authed_conn: _conn} do
      conn = Phoenix.ConnTest.build_conn() |> get("/api/me/profile")
      assert conn.status == 401
    end
  end

  describe "PUT /api/me/profile" do
    test "updates profile fields", %{authed_conn: conn} do
      conn = put(conn, "/api/me/profile", %{"display_name" => "Updated Name"})
      assert %{"profile" => %{"displayName" => "Updated Name"}} = json_response(conn, 200)
    end

    test "rejects invalid fields", %{authed_conn: conn} do
      conn = put(conn, "/api/me/profile", %{"bio" => "short"})
      assert conn.status == 422
    end
  end

  describe "GET /api/me/discovery-preferences" do
    test "returns preferences when they exist", %{authed_conn: conn, profile: profile} do
      Dating.upsert_discovery_preference(profile.id, %{
        age_min: 18,
        age_max: 40,
        distance_km: 25,
        show_men: true,
        show_women: false,
        show_non_binary: false
      })

      conn = get(conn, "/api/me/discovery-preferences")
      assert %{"discoveryPreferences" => %{"distanceKm" => 25}} = json_response(conn, 200)
    end
  end

  describe "PUT /api/me/discovery-preferences" do
    test "creates preferences", %{authed_conn: conn} do
      conn =
        put(conn, "/api/me/discovery-preferences", %{
          "age_min" => 20,
          "age_max" => 35,
          "distance_km" => 50,
          "show_men" => true,
          "show_women" => true,
          "show_non_binary" => false
        })

      assert %{"discoveryPreferences" => %{"distanceKm" => 50}} = json_response(conn, 200)
    end
  end

  describe "POST /api/me/location" do
    test "updates location", %{authed_conn: conn} do
      conn =
        post(conn, "/api/me/location", %{
          "coordinates" => %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
          "recorded_at" => DateTime.to_iso8601(DateTime.utc_now())
        })

      assert json_response(conn, 200) == %{"ok" => true}
    end
  end

  describe "POST /api/me/pause" do
    test "pauses the profile", %{authed_conn: conn} do
      conn = post(conn, "/api/me/pause")
      assert json_response(conn, 200) == %{"ok" => true}
    end
  end

  describe "POST /api/me/unpause" do
    test "unpauses the profile", %{authed_conn: conn} do
      post(conn, "/api/me/pause")
      conn = post(conn, "/api/me/unpause")
      assert json_response(conn, 200) == %{"ok" => true}
    end
  end

  describe "DELETE /api/me/account" do
    test "soft deletes the profile", %{authed_conn: conn, profile: profile} do
      conn = delete(conn, "/api/me/account")
      assert json_response(conn, 200) == %{"ok" => true}

      updated = Repo.get!(Dating.Profile, profile.id)
      assert updated.deleted_at != nil
    end
  end
end
