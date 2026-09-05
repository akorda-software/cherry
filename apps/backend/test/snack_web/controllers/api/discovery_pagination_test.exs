defmodule SnackWeb.Controllers.Api.DiscoveryPaginationTest do
  use SnackWeb.ConnCase, async: false
  import Snack.TestSupport.DatingFixtures
  alias Snack.{Dating, Repo}

  test "pages traverse equal timestamps without duplicates or missing candidates" do
    user = user_fixture()
    complete_profile_fixture(user)
    candidates = for _ <- 1..7, do: complete_profile_fixture(user_fixture())
    timestamp = DateTime.utc_now() |> DateTime.truncate(:second)

    for profile <- candidates,
        do: profile |> Ecto.Changeset.change(updated_at: timestamp) |> Repo.update!()

    conn = authed_conn_for_user(user)

    first = conn |> get("/api/discovery/feed", %{"limit" => "2"}) |> json_response(200)
    repeat = conn |> get("/api/discovery/feed", %{"limit" => "2"}) |> json_response(200)
    assert first["profiles"] == repeat["profiles"]
    assert Enum.all?(first["profiles"], &(&1["sharedTagsCount"] == 3))
    profiles = collect_pages(conn, first, 10)
    ids = Enum.map(profiles, & &1["id"])
    assert length(ids) == 7
    assert MapSet.new(ids) == MapSet.new(candidates, & &1.id)

    assert Enum.map(profiles, & &1["score"]) ==
             Enum.sort(Enum.map(profiles, & &1["score"]), :desc)
  end

  test "a cursor cannot be reused by another viewer" do
    user = user_fixture()
    complete_profile_fixture(user)
    other_user = user_fixture()
    complete_profile_fixture(other_user)
    complete_profile_fixture(user_fixture())

    first =
      user
      |> authed_conn_for_user()
      |> get("/api/discovery/feed", %{"limit" => "1"})
      |> json_response(200)

    assert is_binary(first["nextCursor"])

    assert %{"error" => "invalid_cursor"} =
             other_user
             |> authed_conn_for_user()
             |> get("/api/discovery/feed", %{"cursor" => first["nextCursor"]})
             |> json_response(422)
  end

  test "a blocked tag excludes a candidate even when they have other allowed tags" do
    user = user_fixture()
    viewer = complete_profile_fixture(user)
    candidate = complete_profile_fixture(user_fixture())
    blocked = tag_fixture()
    allowed = tag_fixture()
    Dating.set_profile_tags(candidate.id, [blocked.id, allowed.id])
    Dating.set_profile_blocked_tags(viewer.id, [blocked.id])

    assert %{"profiles" => []} =
             user |> authed_conn_for_user() |> get("/api/discovery/feed") |> json_response(200)
  end

  test "invalid pagination receives a client error" do
    user = user_fixture()
    complete_profile_fixture(user)
    conn = authed_conn_for_user(user)

    for params <- [
          %{"limit" => "abc"},
          %{"limit" => "0"},
          %{"limit" => "101"},
          %{"cursor" => "invalid"}
        ] do
      assert conn |> get("/api/discovery/feed", params) |> response(422)
    end
  end

  defp collect_pages(_conn, %{"profiles" => profiles, "nextCursor" => nil}, _remaining),
    do: profiles

  defp collect_pages(conn, %{"profiles" => profiles, "nextCursor" => cursor}, remaining)
       when remaining > 0 do
    next =
      conn
      |> get("/api/discovery/feed", %{"limit" => "2", "cursor" => cursor})
      |> json_response(200)

    profiles ++ collect_pages(conn, next, remaining - 1)
  end
end
