defmodule SnackWeb.Controllers.Api.DiscoveryControllerTest do
  use SnackWeb.ConnCase, async: false

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Repo
  alias Snack.Sessions

  setup do
    # Create viewer
    {:ok, viewer_user} =
      Accounts.create_user(%{email: "viewer@example.com", display_name: "Viewer"})

    viewer = create_complete_profile(viewer_user, %{gender: "man", what_i_am_looking_for: "relationship"})

    # Create candidate
    {:ok, candidate_user} =
      Accounts.create_user(%{email: "candidate@example.com", display_name: "Candidate"})

    candidate = create_complete_profile(candidate_user, %{gender: "woman", what_i_am_looking_for: "relationship"})

    {:ok, issued} =
      Sessions.issue_session(viewer_user, %{
        installation_id: "viewer-install",
        platform: "ios",
        device_name: "Test Device"
      })

    authed_conn =
      Phoenix.ConnTest.build_conn()
      |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

    %{viewer: viewer, candidate: candidate, authed_conn: authed_conn}
  end

  describe "GET /api/discovery/feed" do
    test "returns candidates for a complete discoverable profile", %{
      authed_conn: conn
    } do
      conn = get(conn, "/api/discovery/feed")
      assert %{"profiles" => profiles} = json_response(conn, 200)
      assert is_list(profiles)
      # Candidate should appear since same intent, close location, compatible preferences
      assert length(profiles) >= 1
    end

    test "returns forbidden for incomplete profile" do
      {:ok, incomplete_user} =
        Accounts.create_user(%{email: "incomplete@example.com", display_name: "Incomplete"})

      {:ok, _incomplete_profile} =
        Dating.create_profile(%{
          user_id: incomplete_user.id,
          display_name: "Incomplete",
          birth_date: ~D[1995-01-15],
          gender: "man",
          what_i_am_looking_for: "relationship",
          bio: "This is a test bio that is long enough to pass validation rules.",
          is_complete: false,
          is_discoverable: false
        })

      {:ok, issued} =
        Sessions.issue_session(incomplete_user, %{
          installation_id: "incomplete-install",
          platform: "ios",
          device_name: "Test Device"
        })

      conn =
        Phoenix.ConnTest.build_conn()
        |> Plug.Conn.put_req_header("authorization", "Bearer #{issued.session.access_token}")

      conn = get(conn, "/api/discovery/feed")
      assert conn.status == 403
      assert %{"error" => "profile_incomplete"} = json_response(conn, 403)
    end
  end

  describe "POST /api/discovery/actions" do
    test "records a like without match when not mutual", %{
      authed_conn: conn,
      candidate: candidate
    } do
      conn = post(conn, "/api/discovery/actions", %{"target_profile_id" => candidate.id, "action_type" => "like"})
      assert %{"matchCreated" => false} = json_response(conn, 200)
    end

    test "creates a match on mutual like", %{
      viewer: viewer,
      candidate: candidate,
      authed_conn: viewer_conn
    } do
      # Candidate likes viewer first
      {:ok, _} = Dating.record_swipe(%{actor_profile_id: candidate.id, target_profile_id: viewer.id, action_type: "like"})

      # Viewer likes candidate
      conn = post(viewer_conn, "/api/discovery/actions", %{"target_profile_id" => candidate.id, "action_type" => "like"})
      assert %{"matchCreated" => true, "match" => match} = json_response(conn, 200)
      assert match["id"] != nil
    end
  end

  defp create_complete_profile(user, attrs) do
    {:ok, profile} =
      Dating.create_profile(
        Map.merge(%{
          user_id: user.id,
          display_name: "Test",
          birth_date: ~D[1995-01-15],
          gender: "woman",
          what_i_am_looking_for: "relationship",
          bio: "This is a test bio that is long enough to pass validation rules.",
          is_discoverable: true
        }, attrs)
      )

    Dating.upsert_discovery_preference(profile.id, %{
      age_min: 18,
      age_max: 50,
      distance_km: 100,
      show_men: true,
      show_women: true,
      show_non_binary: false
    })

    Dating.upsert_location(%{
      profile_id: profile.id,
      coordinates: %Geo.Point{coordinates: {-3.7038, 40.4168}, srid: 4326},
      recorded_at: DateTime.utc_now()
    })

    for i <- 1..2 do
      Dating.create_photo(%{
        profile_id: profile.id,
        storage_key: "photo#{i}",
        url: "https://example.com/photo#{i}.jpg",
        position: i,
        is_active: true
      })
    end

    tags = Dating.list_active_tags() |> Enum.take(2)
    Dating.set_profile_tags(profile.id, Enum.map(tags, & &1.id))

    Dating.set_profile_complete(profile)

    profile = Repo.get!(Dating.Profile, profile.id)

    # Ensure the profile is marked complete and discoverable for tests
    if !profile.is_complete do
      profile
      |> Ecto.Changeset.change(is_complete: true)
      |> Repo.update!()
    else
      profile
    end
  end
end
