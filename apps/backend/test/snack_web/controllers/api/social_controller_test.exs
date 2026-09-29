defmodule SnackWeb.Controllers.Api.SocialControllerTest do
  use SnackWeb.ConnCase, async: false

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Accounts
  alias Snack.Dating
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

  describe "GET /api/profiles/:id" do
    test "shows a discoverable profile without coordinates", ctx do
      %{profile: other} = person(%{display_name: "Lucía"})

      assert %{"profile" => profile} =
               ctx.conn |> get("/api/profiles/#{other.id}") |> json_response(200)

      assert profile["id"] == other.id
      assert profile["displayName"] == "Lucía"
      assert profile["distanceLabel"] == "Cerca de ti"
      assert profile["distanceKmApprox"] == 1
      assert [%{"url" => "https://example.com/photo1.jpg"} | _] = profile["photos"]
      assert Enum.all?(profile["tags"], &(&1["shared"] == true))
      assert profile["likedYou"] == false
      assert profile["youLiked"] == false
      assert profile["matchId"] == nil
      assert profile["conversationId"] == nil
      assert is_boolean(profile["isNewcomer"])

      refute Enum.any?(Map.keys(profile), &(&1 in ["latitude", "longitude", "coordinates"]))
    end

    test "reports likes in both directions", ctx do
      %{profile: other} = person()
      like!(other, ctx.viewer)

      assert %{"profile" => %{"likedYou" => true, "youLiked" => false}} =
               ctx.conn |> get("/api/profiles/#{other.id}") |> json_response(200)
    end

    test "a non-discoverable profile is visible only with a live match", ctx do
      # A like from a paused person no longer makes them visible.
      %{profile: liker} = person()
      like!(liker, ctx.viewer)
      {:ok, _} = Dating.pause_profile(liker)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get("/api/profiles/#{liker.id}") |> json_response(404)

      %{profile: matched} = person()
      {match, conversation} = mutual_match!(ctx.viewer, matched)
      {:ok, _} = Dating.pause_profile(matched)

      assert %{"profile" => %{"matchId" => match_id, "conversationId" => conversation_id}} =
               ctx.conn |> get("/api/profiles/#{matched.id}") |> json_response(200)

      assert match_id == match.id
      assert conversation_id == conversation.id

      %{profile: hidden} = person()
      {:ok, _} = Dating.pause_profile(hidden)

      assert %{"error" => "profile_not_found"} =
               ctx.conn |> get("/api/profiles/#{hidden.id}") |> json_response(404)
    end

    test "blocks in either direction and deleted accounts hide the profile", ctx do
      %{profile: blocker} = person()

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: blocker.id, target_profile_id: ctx.viewer.id})

      %{profile: blocked} = person()

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: ctx.viewer.id, target_profile_id: blocked.id})

      %{profile: deleted, user: deleted_user} = person()
      {:ok, _} = Accounts.delete_account(deleted_user)

      for id <- [blocker.id, blocked.id, deleted.id, Ecto.UUID.generate(), "nope"] do
        assert %{"error" => "profile_not_found"} =
                 ctx.conn |> get("/api/profiles/#{id}") |> json_response(404)
      end
    end

    test "your own profile is a preview without shared tags", ctx do
      assert %{"profile" => profile} =
               ctx.conn |> get("/api/profiles/#{ctx.viewer.id}") |> json_response(200)

      assert Enum.all?(profile["tags"], &(&1["shared"] == false))
    end
  end

  describe "GET /api/likes/received" do
    test "lists pending likes, most recent first, with full cards", ctx do
      %{profile: first} = person(%{display_name: "Ana"})
      %{profile: second} = person(%{display_name: "Bea"})
      like!(first, ctx.viewer)
      like!(second, ctx.viewer)
      backdate_swipe!(first, ctx.viewer, seconds_ago(120))

      assert %{"likes" => [newest, oldest], "nextCursor" => nil} =
               ctx.conn |> get("/api/likes/received") |> json_response(200)

      assert newest["profile"]["id"] == second.id
      assert oldest["profile"]["id"] == first.id
      assert newest["profile"]["likedYou"] == true
      assert [%{"url" => _} | _] = newest["profile"]["photos"]
      assert {:ok, _, _} = DateTime.from_iso8601(newest["likedAt"])
    end

    test "excludes answered, blocked, paused, deleted and tag-blocked likers", ctx do
      %{profile: answered} = person()
      like!(answered, ctx.viewer)
      dislike!(ctx.viewer, answered)

      %{profile: blocked} = person()
      like!(blocked, ctx.viewer)

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: ctx.viewer.id, target_profile_id: blocked.id})

      %{profile: paused} = person()
      like!(paused, ctx.viewer)
      {:ok, _} = Dating.pause_profile(paused)

      %{profile: deleted, user: deleted_user} = person()
      like!(deleted, ctx.viewer)
      {:ok, _} = Accounts.delete_account(deleted_user)

      %{profile: tagged} = person()
      like!(tagged, ctx.viewer)
      blocked_tag = tag_fixture(%{slug: "blocked-#{System.unique_integer()}"})
      {:ok, _} = Dating.set_profile_tags(tagged.id, [blocked_tag.id])
      {:ok, _} = Dating.set_profile_blocked_tags(ctx.viewer.id, [blocked_tag.id])

      %{profile: disliked_me} = person()
      dislike!(disliked_me, ctx.viewer)

      %{profile: visible} = person()
      like!(visible, ctx.viewer)

      assert %{"likes" => [%{"profile" => %{"id" => id}}]} =
               ctx.conn |> get("/api/likes/received") |> json_response(200)

      assert id == visible.id

      assert %{"receivedLikesCount" => 1} =
               ctx.conn |> get("/api/me/summary") |> json_response(200)
    end

    test "excludes likers outside the viewer's gender and age preferences", ctx do
      %{profile: woman} = person(%{gender: "woman"})
      like!(woman, ctx.viewer)
      %{profile: older} = person(%{birth_date: ~D[1960-01-01]})
      like!(older, ctx.viewer)

      {:ok, _} =
        Dating.upsert_discovery_preference(ctx.viewer.id, %{show_women: false, age_max: 40})

      assert %{"likes" => []} = ctx.conn |> get("/api/likes/received") |> json_response(200)
    end

    test "liking back from the likes tab creates the match instantly", ctx do
      %{profile: liker} = person()
      like!(liker, ctx.viewer)

      assert %{"matchCreated" => true, "match" => %{"conversationId" => conversation_id}} =
               ctx.conn
               |> post("/api/discovery/actions", %{
                 "target_profile_id" => liker.id,
                 "action_type" => "like"
               })
               |> json_response(200)

      assert is_binary(conversation_id)
      assert %{"likes" => []} = ctx.conn |> get("/api/likes/received") |> json_response(200)
    end

    test "paginates with an opaque signed cursor", ctx do
      likers = for _ <- 1..3, do: person().profile

      likers
      |> Enum.with_index()
      |> Enum.each(fn {liker, index} ->
        like!(liker, ctx.viewer)
        backdate_swipe!(liker, ctx.viewer, seconds_ago(100 - index))
      end)

      assert %{"likes" => [_, _] = page1, "nextCursor" => cursor} =
               ctx.conn |> get("/api/likes/received", %{"limit" => "2"}) |> json_response(200)

      assert is_binary(cursor)

      assert %{"likes" => [last], "nextCursor" => nil} =
               ctx.conn
               |> get("/api/likes/received", %{"limit" => "2", "cursor" => cursor})
               |> json_response(200)

      ids = Enum.map(page1 ++ [last], & &1["profile"]["id"])
      assert ids == likers |> Enum.reverse() |> Enum.map(& &1.id)

      # A cursor is bound to its viewer.
      other = person()

      assert %{"error" => "invalid_cursor"} =
               other.conn
               |> get("/api/likes/received", %{"cursor" => cursor})
               |> json_response(422)
    end

    test "validates limit and cursor", ctx do
      for params <- [%{"limit" => "0"}, %{"limit" => "51"}, %{"limit" => "abc"}] do
        assert %{"error" => "invalid_limit"} =
                 ctx.conn |> get("/api/likes/received", params) |> json_response(422)
      end

      assert %{"error" => "invalid_cursor"} =
               ctx.conn
               |> get("/api/likes/received", %{"cursor" => "bogus"})
               |> json_response(422)
    end
  end

  describe "GET /api/me/summary" do
    test "counts pending likes, unseen matches and unread conversations", ctx do
      %{profile: liker} = person()
      like!(liker, ctx.viewer)

      %{profile: new_match} = person()
      mutual_match!(ctx.viewer, new_match)

      %{profile: chatty} = person()
      {_match, conversation} = mutual_match!(ctx.viewer, chatty)
      insert_message!(conversation, chatty, "¡Hola!", seconds_ago(30))

      assert %{
               "receivedLikesCount" => 1,
               "newMatchesCount" => 1,
               "unreadConversationsCount" => 1
             } = ctx.conn |> get("/api/me/summary") |> json_response(200)

      assert %{"ok" => true} =
               ctx.conn
               |> post("/api/conversations/#{conversation.id}/read")
               |> json_response(200)

      assert %{"unreadConversationsCount" => 0, "newMatchesCount" => 1} =
               ctx.conn |> get("/api/me/summary") |> json_response(200)
    end

    test "requires a profile" do
      conn = authed_conn_for_user(user_fixture())

      assert %{"error" => "profile_not_found"} =
               conn |> get("/api/me/summary") |> json_response(404)
    end
  end

  describe "GET /api/me/profile" do
    test "exposes hasLocation without coordinates", ctx do
      assert %{"profile" => %{"hasLocation" => true} = profile} =
               ctx.conn |> get("/api/me/profile") |> json_response(200)

      refute Map.has_key?(profile, "location")

      Repo.delete!(Dating.get_location(ctx.viewer.id))

      assert %{"profile" => %{"hasLocation" => false}} =
               ctx.conn |> get("/api/me/profile") |> json_response(200)
    end
  end
end
