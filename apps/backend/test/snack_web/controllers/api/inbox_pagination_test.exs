defmodule SnackWeb.Controllers.Api.InboxPaginationTest do
  use SnackWeb.ConnCase, async: true

  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Dating
  alias Snack.Dating.Inbox

  setup do
    user = user_fixture()
    viewer = profile_fixture(user)
    %{viewer: viewer, conn: authed_conn_for_user(user)}
  end

  defp entries(viewer, n) do
    for _ <- 1..n do
      other = profile_fixture(user_fixture())
      {match, conversation} = mutual_match!(viewer, other)
      %{match: match, conversation: conversation, other: other}
    end
  end

  test "default page is bounded and the remaining matches stay accessible", ctx do
    entries(ctx.viewer, 53)
    first = ctx.conn |> get("/api/matches") |> json_response(200)
    assert length(first["matches"]) == 50
    assert is_binary(first["nextCursor"])
    second = ctx.conn |> get("/api/matches", %{cursor: first["nextCursor"]}) |> json_response(200)
    assert length(second["matches"]) == 3
    assert second["nextCursor"] == nil

    assert 53 ==
             (first["matches"] ++ second["matches"])
             |> Enum.map(& &1["id"])
             |> Enum.uniq()
             |> length()

    conversations = ctx.conn |> get("/api/conversations") |> json_response(200)
    assert length(conversations["conversations"]) == 50

    remaining =
      ctx.conn
      |> get("/api/conversations", %{cursor: conversations["nextCursor"]})
      |> json_response(200)

    assert length(remaining["conversations"]) == 3
    assert remaining["nextCursor"] == nil
  end

  test "same-time ties paginate without gaps and new messages don't reorder later pages", ctx do
    entries(ctx.viewer, 7)
    {:ok, first} = Inbox.list_page(ctx.viewer.id, limit: 2)
    {:ok, all} = Inbox.list_page(ctx.viewer.id, limit: 100, now: DateTime.utc_now())
    older = List.last(all.entries)

    {:ok, _} =
      Dating.send_message(%{
        conversation_id: older.conversation_id,
        sender_profile_id: ctx.viewer.id,
        body: "Arrived after page 1"
      })

    {seen, cursor} =
      Enum.reduce(1..3, {first.entries, first.next_cursor}, fn _, {seen, cursor} ->
        {:ok, page} = Inbox.list_page(ctx.viewer.id, limit: 2, cursor: cursor)
        {seen ++ page.entries, page.next_cursor}
      end)

    assert cursor == nil
    assert Enum.map(seen, & &1.match.id) == Enum.map(all.entries, & &1.match.id)
    assert List.last(seen).last_message == nil
    {:ok, refreshed} = Inbox.list_page(ctx.viewer.id, limit: 2)
    assert hd(refreshed.entries).match.id == older.match.id
  end

  test "cursors are signed for the viewer and reject malformed input", ctx do
    entries(ctx.viewer, 3)
    first = ctx.conn |> get("/api/matches", %{limit: 1}) |> json_response(200)
    outsider = authed_conn_for_user(user_fixture() |> tap(&profile_fixture/1))

    for conn <- [ctx.conn, outsider] do
      cursor =
        if conn == ctx.conn, do: first["nextCursor"] <> "tampered", else: first["nextCursor"]

      assert %{"error" => "invalid_cursor"} =
               conn |> get("/api/conversations", %{cursor: cursor}) |> json_response(422)
    end

    for path <- ["/api/matches", "/api/conversations"], limit <- ["0", "101", "not-a-number"] do
      assert %{"error" => "invalid_limit"} =
               ctx.conn |> get(path, %{limit: limit}) |> json_response(422)
    end
  end

  test "visibility is reevaluated between pages and for direct conversation links", ctx do
    entries(ctx.viewer, 3)
    {:ok, first} = Inbox.list_page(ctx.viewer.id, limit: 1)
    {:ok, second} = Inbox.list_page(ctx.viewer.id, limit: 1, cursor: first.next_cursor)
    entry = hd(second.entries)
    path = "/api/conversations/#{entry.conversation_id}/match"
    assert %{"match" => %{"id" => id}} = ctx.conn |> get(path) |> json_response(200)
    assert id == entry.match.id
    outsider = authed_conn_for_user(user_fixture() |> tap(&profile_fixture/1))
    assert %{"error" => "conversation_not_active"} = outsider |> get(path) |> json_response(403)

    {:ok, _} =
      Dating.block_profile(%{actor_profile_id: ctx.viewer.id, target_profile_id: entry.other.id})

    {:ok, page} = Inbox.list_page(ctx.viewer.id, cursor: first.next_cursor)
    refute Enum.any?(page.entries, &(&1.match.id == id))
    assert %{"error" => "conversation_not_active"} = ctx.conn |> get(path) |> json_response(403)
  end
end
