defmodule SnackWeb.Controllers.Api.SocialVisibilityTest do
  @moduledoc """
  Filtros duros en el perfil público (`GET /api/profiles/:id`) y en el destino
  de un swipe (`POST /api/discovery/actions`): etiquetas bloqueadas, intención,
  género/edad y `compatible_only`, con la excepción del match vivo; viewer
  activo; likes históricos; deshacer con perfil no visible.
  """

  use SnackWeb.ConnCase, async: false

  import Ecto.Query
  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating
  alias Snack.Dating.SwipeAction
  alias Snack.Dating.Tag
  alias Snack.Repo

  setup do
    viewer_user = user_fixture()
    viewer = complete_profile_fixture(viewer_user, %{display_name: "Vera"})
    %{viewer: viewer, viewer_user: viewer_user, conn: authed_conn_for_user(viewer_user)}
  end

  defp person(attrs \\ %{}) do
    user = user_fixture()
    profile = complete_profile_fixture(user, attrs)
    %{user: user, profile: profile, conn: authed_conn_for_user(user)}
  end

  defp unique_tag, do: tag_fixture(%{slug: "t-#{System.unique_integer([:positive])}"})

  defp get_profile(conn, id), do: get(conn, "/api/profiles/#{id}")

  defp like(conn, id) do
    post(conn, "/api/discovery/actions", %{"target_profile_id" => id, "action_type" => "like"})
  end

  defp assert_hidden(ctx, target_id) do
    assert %{"error" => "profile_not_found"} =
             ctx.conn |> get_profile(target_id) |> json_response(404)

    assert %{"error" => "profile_not_found"} =
             ctx.conn |> like(target_id) |> json_response(404)

    refute Repo.get_by(SwipeAction, actor_profile_id: ctx.viewer.id, target_profile_id: target_id)
  end

  defp assert_visible(ctx, target_id) do
    assert %{"profile" => %{"id" => ^target_id}} =
             ctx.conn |> get_profile(target_id) |> json_response(200)
  end

  describe "blocked tags" do
    test "hide a profile carrying one of my blocked tags", ctx do
      %{profile: other} = person()
      tag = unique_tag()
      {:ok, _} = Dating.set_profile_tags(other.id, [tag.id])
      assert_visible(ctx, other.id)

      {:ok, _} = Dating.set_profile_blocked_tags(ctx.viewer.id, [tag.id])
      assert_hidden(ctx, other.id)
    end

    test "hide a profile that blocks one of my tags", ctx do
      %{profile: other} = person()
      tag = unique_tag()
      {:ok, _} = Dating.set_profile_tags(ctx.viewer.id, [tag.id])
      {:ok, _} = Dating.set_profile_blocked_tags(other.id, [tag.id])

      assert_hidden(ctx, other.id)
    end

    test "also hide someone who liked me (no match can be created)", ctx do
      %{profile: other} = person()
      tag = unique_tag()
      {:ok, _} = Dating.set_profile_tags(other.id, [tag.id])
      like!(other, ctx.viewer)
      {:ok, _} = Dating.set_profile_blocked_tags(ctx.viewer.id, [tag.id])

      assert_hidden(ctx, other.id)
      assert Dating.list_matches(ctx.viewer.id) == []
    end

    test "do not hide a live match, so the chat keeps working", ctx do
      %{profile: other} = person()
      tag = unique_tag()
      {:ok, _} = Dating.set_profile_tags(other.id, [tag.id])
      {match, _conversation} = mutual_match!(ctx.viewer, other)
      {:ok, _} = Dating.set_profile_blocked_tags(ctx.viewer.id, [tag.id])

      match_id = match.id

      assert %{"profile" => %{"matchId" => ^match_id}} =
               ctx.conn |> get_profile(other.id) |> json_response(200)
    end
  end

  describe "intent, gender, age and compatible_only" do
    test "relationship and casual never see each other", ctx do
      %{profile: casual} = person(%{what_i_am_looking_for: "casual"})
      assert_hidden(ctx, casual.id)

      %{profile: flow} = person(%{what_i_am_looking_for: "go_with_the_flow"})
      assert_visible(ctx, flow.id)
    end

    test "my gender and age preferences apply", ctx do
      %{profile: woman} = person(%{gender: "woman"})
      %{profile: older} = person(%{birth_date: ~D[1970-01-01]})

      {:ok, _} = Dating.upsert_discovery_preference(ctx.viewer.id, %{show_women: false})

      assert_hidden(ctx, woman.id)
      assert_hidden(ctx, older.id)
    end

    test "their preferences apply unless they have a pending like to me", ctx do
      %{profile: picky} = person()

      {:ok, _} =
        Dating.upsert_discovery_preference(picky.id, %{show_men: false, show_women: true})

      assert_hidden(ctx, picky.id)

      %{profile: young_only} = person()
      {:ok, _} = Dating.upsert_discovery_preference(young_only.id, %{age_min: 18, age_max: 20})
      assert_hidden(ctx, young_only.id)

      # Their like is their consent (as in the likes inbox): visible and a
      # like back creates the match.
      %{profile: liker} = person()
      like!(liker, ctx.viewer)

      {:ok, _} =
        Dating.upsert_discovery_preference(liker.id, %{show_men: false, show_women: true})

      assert_visible(ctx, liker.id)
      assert %{"matchCreated" => true} = ctx.conn |> like(liker.id) |> json_response(200)
    end

    test "compatible_only of either side requires a shared active tag", ctx do
      mine = unique_tag()
      {:ok, _} = Dating.set_profile_tags(ctx.viewer.id, [mine.id])

      %{profile: strict} = person()
      {:ok, _} = Dating.set_profile_tags(strict.id, [unique_tag().id])
      {:ok, _} = Dating.upsert_discovery_preference(strict.id, %{compatible_only: true})
      assert_hidden(ctx, strict.id)

      %{profile: other} = person()
      {:ok, _} = Dating.set_profile_tags(other.id, [unique_tag().id])
      assert_visible(ctx, other.id)
      {:ok, _} = Dating.upsert_discovery_preference(ctx.viewer.id, %{compatible_only: true})
      assert_hidden(ctx, other.id)

      # A shared tag that the catalog deactivated does not count.
      {:ok, _} = Dating.set_profile_tags(other.id, [mine.id])
      assert_visible(ctx, other.id)
      Repo.update_all(from(t in Tag, where: t.id == ^mine.id), set: [is_active: false])
      assert_hidden(ctx, other.id)
    end
  end

  describe "historical likes" do
    test "an ex match is only visible while discoverable", ctx do
      %{profile: ex} = person()
      {match, _conversation} = mutual_match!(ctx.viewer, ex)
      {:ok, _} = Dating.unmatch(match.id)
      assert_visible(ctx, ex.id)

      {:ok, _} = Dating.pause_profile(ex)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get_profile(ex.id) |> json_response(404)
    end

    test "an expired match does not keep the profile visible", ctx do
      %{profile: ex} = person()
      {match, _conversation} = mutual_match!(ctx.viewer, ex)
      expire_match!(match)
      {:ok, _} = Dating.pause_profile(ex)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get_profile(ex.id) |> json_response(404)
    end

    test "a liker who left discovery is not visible", ctx do
      %{profile: liker} = person()
      like!(liker, ctx.viewer)
      liker |> Ecto.Changeset.change(is_discoverable: false) |> Repo.update!()

      assert_hidden(ctx, liker.id)
    end
  end

  describe "inactive viewer" do
    test "a paused viewer cannot swipe nor browse other profiles", ctx do
      %{profile: other} = person()
      {:ok, _} = Dating.pause_profile(ctx.viewer)

      assert %{"error" => "profile_paused", "onboardingRequired" => false} =
               ctx.conn |> like(other.id) |> json_response(403)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get_profile(other.id) |> json_response(404)

      # Own preview still works.
      assert_visible(ctx, ctx.viewer.id)
    end

    test "an incomplete viewer cannot swipe but still sees live matches", ctx do
      %{profile: other} = person()
      %{profile: matched} = person()
      {match, _conversation} = mutual_match!(ctx.viewer, matched)
      ctx.viewer |> Ecto.Changeset.change(is_complete: false) |> Repo.update!()

      assert %{"error" => "profile_incomplete", "onboardingRequired" => true} =
               ctx.conn |> like(other.id) |> json_response(403)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get_profile(other.id) |> json_response(404)

      match_id = match.id

      assert %{"profile" => %{"matchId" => ^match_id}} =
               ctx.conn |> get_profile(matched.id) |> json_response(200)

      assert %{"error" => "profile_incomplete"} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(403)
    end
  end

  describe "POST /api/discovery/undo" do
    test "applies the undo and returns a null profile when it is no longer visible", ctx do
      %{profile: other} = person()
      dislike!(ctx.viewer, other)
      {:ok, _} = Dating.pause_profile(other)

      assert %{"undone" => true, "profile" => nil} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(200)

      refute Repo.get_by(SwipeAction, actor_profile_id: ctx.viewer.id)
    end

    test "returns a null profile when a hard filter now hides it", ctx do
      %{profile: other} = person()
      tag = unique_tag()
      {:ok, _} = Dating.set_profile_tags(other.id, [tag.id])
      dislike!(ctx.viewer, other)
      {:ok, _} = Dating.set_profile_blocked_tags(ctx.viewer.id, [tag.id])

      assert %{"undone" => true, "profile" => nil} =
               ctx.conn |> post("/api/discovery/undo") |> json_response(200)
    end
  end

  describe "block vs like race" do
    test "record_swipe revalidates the block under the pair lock", ctx do
      %{profile: other} = person()

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: other.id, target_profile_id: ctx.viewer.id})

      assert {:error, :blocked} =
               Dating.record_swipe(%{
                 actor_profile_id: ctx.viewer.id,
                 target_profile_id: other.id,
                 action_type: "like"
               })

      refute Repo.get_by(SwipeAction, actor_profile_id: ctx.viewer.id)
    end
  end

  describe "GET /api/likes/received" do
    test "excludes incomplete or non-discoverable likers", ctx do
      %{profile: incomplete} = person()
      like!(incomplete, ctx.viewer)
      incomplete |> Ecto.Changeset.change(is_complete: false) |> Repo.update!()

      %{profile: hidden} = person()
      like!(hidden, ctx.viewer)
      hidden |> Ecto.Changeset.change(is_discoverable: false) |> Repo.update!()

      assert %{"likes" => []} = ctx.conn |> get("/api/likes/received") |> json_response(200)
    end

    test "applies the viewer's compatible_only", ctx do
      {:ok, _} = Dating.set_profile_tags(ctx.viewer.id, [unique_tag().id])
      %{profile: liker} = person()
      {:ok, _} = Dating.set_profile_tags(liker.id, [unique_tag().id])
      like!(liker, ctx.viewer)

      assert %{"likes" => [_like]} = ctx.conn |> get("/api/likes/received") |> json_response(200)

      {:ok, _} = Dating.upsert_discovery_preference(ctx.viewer.id, %{compatible_only: true})
      assert %{"likes" => []} = ctx.conn |> get("/api/likes/received") |> json_response(200)
    end
  end
end
