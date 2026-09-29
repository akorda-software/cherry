defmodule SnackWeb.Controllers.Api.DiscoverySocialTest do
  use SnackWeb.ConnCase, async: false

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating
  alias Snack.Dating.SwipeAction
  alias Snack.Repo

  setup do
    viewer_user = user_fixture()
    candidate_user = user_fixture()
    viewer = complete_profile_fixture(viewer_user, %{display_name: "Vera"})
    candidate = complete_profile_fixture(candidate_user, %{display_name: "Lucía"})

    %{
      viewer: viewer,
      candidate: candidate,
      conn: authed_conn_for_user(viewer_user),
      candidate_conn: authed_conn_for_user(candidate_user)
    }
  end

  describe "GET /api/discovery/feed cards" do
    test "include photos, tags with shared flag and social signals", ctx do
      own_tag = tag_fixture(%{slug: "hiking-#{System.unique_integer()}", category: "active"})
      other_tag = tag_fixture(%{slug: "cats-#{System.unique_integer()}", category: "pets"})
      {:ok, _} = Dating.set_profile_tags(ctx.viewer.id, [own_tag.id])
      {:ok, _} = Dating.set_profile_tags(ctx.candidate.id, [other_tag.id, own_tag.id])
      like!(ctx.candidate, ctx.viewer)

      assert %{"profiles" => [card], "nextCursor" => nil} =
               ctx.conn |> get("/api/discovery/feed") |> json_response(200)

      assert card["id"] == ctx.candidate.id

      assert [%{"url" => "https://example.com/photo1.jpg", "position" => 1}, %{"position" => 2}] =
               card["photos"]

      assert card["photoUrl"] == "https://example.com/photo1.jpg"
      assert card["photoCount"] == 2

      assert [
               %{"id" => shared_id, "shared" => true, "emoji" => _emoji, "sortOrder" => _},
               %{"id" => not_shared_id, "shared" => false}
             ] = card["tags"]

      assert shared_id == own_tag.id
      assert not_shared_id == other_tag.id
      assert card["likedYou"] in [true, false]
      assert is_boolean(card["isNewcomer"])
      assert card["beyondPreferredDistance"] == false
      refute Map.has_key?(card, "latitude")
    end

    test "resolves relative photo URLs against the request host", ctx do
      Dating.list_photos(ctx.candidate.id)
      |> Enum.each(&Dating.delete_photo/1)

      {:ok, _photo} =
        Dating.create_photo(%{
          profile_id: ctx.candidate.id,
          storage_key: "local/photo.jpg",
          url: "/uploads/local/photo.jpg",
          position: 1
        })

      assert %{"profiles" => [card]} =
               ctx.conn |> get("/api/discovery/feed") |> json_response(200)

      assert card["photoUrl"] == "http://www.example.com/uploads/local/photo.jpg"
      assert [%{"url" => "http://www.example.com/uploads/local/photo.jpg"}] = card["photos"]
    end

    test "incomplete profiles get onboarding hints", %{viewer: viewer, conn: conn} do
      viewer |> Ecto.Changeset.change(is_complete: false) |> Repo.update!()

      assert %{
               "error" => "profile_incomplete",
               "onboardingRequired" => true,
               "nextOnboardingStep" => _step
             } = conn |> get("/api/discovery/feed") |> json_response(403)
    end

    test "paused profiles get a distinct error", %{viewer: viewer, conn: conn} do
      {:ok, _} = Dating.pause_profile(viewer)

      assert %{"error" => "profile_paused", "onboardingRequired" => false} =
               conn |> get("/api/discovery/feed") |> json_response(403)
    end
  end

  describe "distance labels" do
    test "use approximate buckets and an accented label beyond 100 km" do
      assert SnackWeb.ProfileCardJSON.distance_label(1_500) == "Cerca de ti"
      assert SnackWeb.ProfileCardJSON.distance_label(7_400) == "A unos 7 km"
      assert SnackWeb.ProfileCardJSON.distance_label(23_000) == "A unos 25 km"
      assert SnackWeb.ProfileCardJSON.distance_label(160_000) == "A más de 150 km"
      assert SnackWeb.ProfileCardJSON.distance_label(nil) == nil
      assert SnackWeb.ProfileCardJSON.approximate_distance_km(160_000) == 150
    end
  end

  describe "POST /api/discovery/actions" do
    test "a mutual like returns the conversation and the other profile photo", ctx do
      like!(ctx.candidate, ctx.viewer)

      assert %{"matchCreated" => true, "match" => match} =
               ctx.conn
               |> post("/api/discovery/actions", %{
                 "target_profile_id" => ctx.candidate.id,
                 "action_type" => "like"
               })
               |> json_response(200)

      conversation = Repo.get_by!(Dating.Conversation, match_id: match["id"])
      assert match["conversationId"] == conversation.id

      assert match["otherProfile"] == %{
               "id" => ctx.candidate.id,
               "displayName" => "Lucía",
               "age" => Dating.Profile.age(ctx.candidate),
               "photoUrl" => "https://example.com/photo1.jpg"
             }

      {:ok, expires_at, _} = DateTime.from_iso8601(match["expiresAt"])
      assert_in_delta DateTime.diff(expires_at, DateTime.utc_now(), :day), 30, 1
    end

    test "a duplicate swipe is a conflict", ctx do
      body = %{"target_profile_id" => ctx.candidate.id, "action_type" => "dislike"}

      assert %{"matchCreated" => false} =
               ctx.conn |> post("/api/discovery/actions", body) |> json_response(200)

      assert %{"error" => "already_swiped"} =
               ctx.conn |> post("/api/discovery/actions", body) |> json_response(409)
    end

    test "swiping yourself is rejected", ctx do
      assert %{"error" => "cannot_swipe_self"} =
               ctx.conn
               |> post("/api/discovery/actions", %{
                 "target_profile_id" => ctx.viewer.id,
                 "action_type" => "like"
               })
               |> json_response(422)
    end

    test "unknown, invalid or invisible targets are not found", ctx do
      hidden = complete_profile_fixture(user_fixture())
      {:ok, _} = Dating.pause_profile(hidden)
      blocked = complete_profile_fixture(user_fixture())

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: blocked.id, target_profile_id: ctx.viewer.id})

      for target_id <- [Ecto.UUID.generate(), "not-a-uuid", hidden.id, blocked.id] do
        assert %{"error" => "profile_not_found"} =
                 ctx.conn
                 |> post("/api/discovery/actions", %{
                   "target_profile_id" => target_id,
                   "action_type" => "like"
                 })
                 |> json_response(404)
      end
    end

    test "a paused person who liked you cannot be liked back until they unpause", ctx do
      like!(ctx.candidate, ctx.viewer)
      {:ok, _} = Dating.pause_profile(ctx.candidate)
      body = %{"target_profile_id" => ctx.candidate.id, "action_type" => "like"}

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> post("/api/discovery/actions", body) |> json_response(404)
    end

    test "invalid action types and missing params are unprocessable", ctx do
      assert %{"error" => "invalid_action_type"} =
               ctx.conn
               |> post("/api/discovery/actions", %{
                 "target_profile_id" => ctx.candidate.id,
                 "action_type" => "superlike"
               })
               |> json_response(422)

      assert %{"error" => "invalid_params"} =
               ctx.conn |> post("/api/discovery/actions", %{}) |> json_response(422)
    end
  end

  describe "POST /api/discovery/undo" do
    test "restores the last dislike and returns its card", ctx do
      dislike!(ctx.viewer, ctx.candidate)

      assert %{"undone" => true, "profile" => card} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(200)

      assert card["id"] == ctx.candidate.id
      refute Map.has_key?(card, "score")
      assert [%{"url" => _} | _] = card["photos"]
      assert card["distanceLabel"] == "Cerca de ti"
      refute Repo.get_by(SwipeAction, actor_profile_id: ctx.viewer.id)

      assert %{"profiles" => [%{"id" => id}]} =
               ctx.conn |> get("/api/discovery/feed") |> json_response(200)

      assert id == ctx.candidate.id
    end

    test "only undoes the most recent swipe when it is a dislike", ctx do
      other = complete_profile_fixture(user_fixture())
      dislike!(ctx.viewer, ctx.candidate)
      backdate_swipe!(ctx.viewer, ctx.candidate, seconds_ago(60))
      like!(ctx.viewer, other)

      assert %{"error" => "nothing_to_undo"} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(422)

      assert Repo.get_by(SwipeAction,
               actor_profile_id: ctx.viewer.id,
               target_profile_id: ctx.candidate.id
             )
    end

    test "prefers the dislike among swipes of the same second", ctx do
      other = complete_profile_fixture(user_fixture())
      now = seconds_ago(5)
      like!(ctx.viewer, other)
      dislike!(ctx.viewer, ctx.candidate)
      backdate_swipe!(ctx.viewer, other, now)
      backdate_swipe!(ctx.viewer, ctx.candidate, now)

      assert %{"profile" => %{"id" => id}} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(200)

      assert id == ctx.candidate.id
    end

    test "dislikes older than 10 minutes cannot be undone", ctx do
      dislike!(ctx.viewer, ctx.candidate)
      backdate_swipe!(ctx.viewer, ctx.candidate, seconds_ago(11 * 60))

      assert %{"error" => "nothing_to_undo"} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(422)
    end

    test "nothing to undo without swipes", %{conn: conn} do
      assert %{"error" => "nothing_to_undo"} =
               conn |> post("/api/discovery/undo") |> json_response(422)
    end
  end
end
