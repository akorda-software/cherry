defmodule SnackWeb.Controllers.Api.MatchChatControllerTest do
  use SnackWeb.ConnCase, async: false

  import Ecto.Query
  import Snack.TestSupport.DatingFixtures
  import Snack.TestSupport.SocialFixtures

  alias Snack.Accounts
  alias Snack.Dating
  alias Snack.Dating.Match
  alias Snack.Dating.MatchExpiry
  alias Snack.Repo

  setup do
    viewer_user = user_fixture()
    viewer = complete_profile_fixture(viewer_user, %{display_name: "Vera"})
    %{viewer: viewer, conn: authed_conn_for_user(viewer_user)}
  end

  defp person(attrs \\ %{}) do
    user = user_fixture()
    profile = complete_profile_fixture(user, attrs)
    %{user: user, profile: profile, conn: authed_conn_for_user(user)}
  end

  describe "GET /api/matches" do
    test "returns photo, last message (decrypted) and unread count, by activity", ctx do
      %{profile: quiet} = person(%{display_name: "Quique"})
      %{profile: chatty} = person(%{display_name: "Lucía"})
      {quiet_match, _} = mutual_match!(ctx.viewer, quiet)
      {chatty_match, conversation} = mutual_match!(ctx.viewer, chatty)

      Repo.update_all(
        from(m in Match, where: m.id == ^chatty_match.id),
        set: [matched_at: seconds_ago(3600)]
      )

      insert_message!(conversation, ctx.viewer, "Hola 👋", seconds_ago(60))
      insert_message!(conversation, chatty, "¡Hola! ¿Qué tal?", seconds_ago(30))

      assert %{"matches" => [first, second]} =
               ctx.conn |> get("/api/matches") |> json_response(200)

      # Quiet match: matched now; chatty: last message 30 s ago → quiet first.
      assert first["id"] == quiet_match.id
      assert first["lastMessage"] == nil
      assert first["unreadCount"] == 0
      assert first["firstMessageAt"] == nil
      assert {:ok, _, _} = DateTime.from_iso8601(first["expiresAt"])

      assert second["id"] == chatty_match.id
      assert second["conversationId"] == conversation.id
      assert second["expiresAt"] == nil
      assert second["lastMessage"]["body"] == "¡Hola! ¿Qué tal?"
      assert second["lastMessage"]["senderProfileId"] == chatty.id
      assert second["unreadCount"] == 1

      assert second["otherProfile"] == %{
               "id" => chatty.id,
               "displayName" => "Lucía",
               "age" => Dating.Profile.age(chatty),
               "photoUrl" => "https://example.com/photo1.jpg"
             }
    end

    test "excludes expired, unmatched, blocked and deleted-account matches", ctx do
      %{profile: expired} = person()
      {expired_match, _} = mutual_match!(ctx.viewer, expired)
      expire_match!(expired_match)

      %{profile: unmatched} = person()
      {unmatched_match, _} = mutual_match!(ctx.viewer, unmatched)
      {:ok, _} = Dating.unmatch(unmatched_match.id)

      %{profile: blocked} = person()
      mutual_match!(ctx.viewer, blocked)

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: blocked.id, target_profile_id: ctx.viewer.id})

      %{profile: deleted, user: deleted_user} = person()
      mutual_match!(ctx.viewer, deleted)
      {:ok, _} = Accounts.delete_account(deleted_user)

      %{profile: alive} = person()
      {alive_match, _} = mutual_match!(ctx.viewer, alive)

      assert %{"matches" => [%{"id" => id}]} =
               ctx.conn |> get("/api/matches") |> json_response(200)

      assert id == alive_match.id

      assert %{"conversations" => [%{"matchId" => ^id}]} =
               ctx.conn |> get("/api/conversations") |> json_response(200)

      refute expired_match.id in Enum.map(Dating.list_matches(ctx.viewer.id), & &1.id)
    end
  end

  describe "POST /api/matches/:id/unmatch" do
    test "only participants can unmatch", ctx do
      %{profile: other} = person()
      {match, _} = mutual_match!(ctx.viewer, other)
      outsider = person()

      assert %{"error" => "not_participant"} =
               outsider.conn |> post("/api/matches/#{match.id}/unmatch") |> json_response(403)

      assert %{"error" => "match_not_found"} =
               ctx.conn
               |> post("/api/matches/#{Ecto.UUID.generate()}/unmatch")
               |> json_response(404)

      assert %{"ok" => true} =
               ctx.conn |> post("/api/matches/#{match.id}/unmatch") |> json_response(200)

      assert Repo.get!(Match, match.id).status == "unmatched"
      assert %{"matches" => []} = ctx.conn |> get("/api/matches") |> json_response(200)
    end
  end

  describe "conversations" do
    setup ctx do
      %{profile: other, conn: other_conn} = person(%{display_name: "Lucía"})
      {match, conversation} = mutual_match!(ctx.viewer, other)
      %{other: other, other_conn: other_conn, match: match, conversation: conversation}
    end

    test "GET /api/conversations is enriched like matches", ctx do
      insert_message!(ctx.conversation, ctx.other, "¿Café?", seconds_ago(10))

      assert %{"conversations" => [conversation]} =
               ctx.conn |> get("/api/conversations") |> json_response(200)

      assert conversation["id"] == ctx.conversation.id
      assert conversation["matchId"] == ctx.match.id
      assert conversation["lastMessage"]["body"] == "¿Café?"
      assert conversation["unreadCount"] == 1
      assert conversation["otherProfile"]["photoUrl"] == "https://example.com/photo1.jpg"
    end

    test "messages paginate newest first with an opaque cursor, even within one second", ctx do
      same_second = seconds_ago(5)

      messages =
        for i <- 1..5 do
          at = if i >= 3, do: same_second, else: seconds_ago(100 - i)
          insert_message!(ctx.conversation, ctx.other, "Mensaje #{i}", at)
        end

      path = "/api/conversations/#{ctx.conversation.id}/messages"

      assert %{"messages" => page1, "nextCursor" => cursor1} =
               ctx.conn |> get(path, %{"limit" => "2"}) |> json_response(200)

      assert %{"messages" => page2, "nextCursor" => cursor2} =
               ctx.conn |> get(path, %{"limit" => "2", "cursor" => cursor1}) |> json_response(200)

      assert %{"messages" => page3, "nextCursor" => nil} =
               ctx.conn |> get(path, %{"limit" => "2", "cursor" => cursor2}) |> json_response(200)

      ids = Enum.map(page1 ++ page2 ++ page3, & &1["id"])
      assert length(ids) == 5
      assert Enum.sort(ids) == messages |> Enum.map(& &1.id) |> Enum.sort()
      assert Enum.uniq(ids) == ids
      assert List.last(page3)["body"] == "Mensaje 1"

      # Legacy ISO 8601 cursors keep working.
      legacy = same_second |> DateTime.to_iso8601()

      assert %{"messages" => [%{"body" => "Mensaje 2"}, %{"body" => "Mensaje 1"}]} =
               ctx.conn |> get(path, %{"cursor" => legacy}) |> json_response(200)
    end

    test "history is closed once the conversation is no longer active", ctx do
      insert_message!(ctx.conversation, ctx.other, "Hola", seconds_ago(10))
      {:ok, _} = Dating.unmatch(ctx.match.id)

      assert %{"error" => "conversation_not_active"} =
               ctx.conn
               |> get("/api/conversations/#{ctx.conversation.id}/messages")
               |> json_response(403)
    end

    test "reading resets unread counts; replying marks as read", ctx do
      insert_message!(ctx.conversation, ctx.viewer, "¿Hablamos?", seconds_ago(10))

      assert %{"unreadConversationsCount" => 1} =
               ctx.other_conn |> get("/api/me/summary") |> json_response(200)

      # Replying implies having read the conversation.
      assert %{"message" => %{"body" => "¡Sí!"}} =
               ctx.other_conn
               |> post("/api/conversations/#{ctx.conversation.id}/messages", %{"body" => "¡Sí!"})
               |> json_response(200)

      assert %{"unreadConversationsCount" => 0} =
               ctx.other_conn |> get("/api/me/summary") |> json_response(200)

      assert %{"matches" => [%{"unreadCount" => 1}]} =
               ctx.conn |> get("/api/matches") |> json_response(200)

      assert %{"ok" => true} =
               ctx.conn
               |> post("/api/conversations/#{ctx.conversation.id}/read")
               |> json_response(200)

      assert %{"matches" => [%{"unreadCount" => 0}]} =
               ctx.conn |> get("/api/matches") |> json_response(200)
    end

    test "only participants can mark as read", ctx do
      outsider = person()

      assert %{"error" => "not_participant"} =
               outsider.conn
               |> post("/api/conversations/#{ctx.conversation.id}/read")
               |> json_response(403)

      assert %{"error" => "not_participant"} =
               ctx.conn |> post("/api/conversations/not-a-uuid/read") |> json_response(403)
    end

    test "sending without body is unprocessable", ctx do
      assert %{"errors" => %{"body" => _}} =
               ctx.conn
               |> post("/api/conversations/#{ctx.conversation.id}/messages", %{})
               |> json_response(422)
    end
  end

  describe "match expiry" do
    test "new matches expire after the configured 30 days", ctx do
      %{profile: other} = person()
      {match, _} = mutual_match!(ctx.viewer, other)

      assert MatchExpiry.days() == 30
      assert DateTime.diff(match.expires_at, match.matched_at, :day) == 30
    end

    test "the expiry is configurable", ctx do
      previous = Application.get_env(:snack, :match_expiry_days)
      Application.put_env(:snack, :match_expiry_days, 3)
      on_exit(fn -> Application.put_env(:snack, :match_expiry_days, previous) end)

      %{profile: other} = person()
      {match, _} = mutual_match!(ctx.viewer, other)
      assert DateTime.diff(match.expires_at, match.matched_at, :day) == 3
    end

    test "expire_stale/1 marks only overdue matches without messages", ctx do
      %{profile: overdue} = person()
      {overdue_match, _} = mutual_match!(ctx.viewer, overdue)
      expire_match!(overdue_match)

      %{profile: fresh} = person()
      {fresh_match, _} = mutual_match!(ctx.viewer, fresh)

      assert MatchExpiry.expire_stale() == 1
      assert Repo.get!(Match, overdue_match.id).status == "expired"
      assert Repo.get!(Match, fresh_match.id).status == "active"
      assert MatchExpiry.expire_stale() == 0
    end

    test "the sweeper runs expire_stale periodically", ctx do
      %{profile: overdue} = person()
      {overdue_match, _} = mutual_match!(ctx.viewer, overdue)
      expire_match!(overdue_match)

      {:ok, pid} =
        start_supervised(
          {Snack.Dating.MatchExpirySweeper,
           name: :test_match_expiry_sweeper, enabled: true, initial_delay_ms: 60_000}
        )

      Ecto.Adapters.SQL.Sandbox.allow(Repo, self(), pid)
      send(pid, :sweep)
      :sys.get_state(pid)

      assert Repo.get!(Match, overdue_match.id).status == "expired"
    end

    test "the sweeper is disabled under the sandbox by default" do
      assert :ignore = Snack.Dating.MatchExpirySweeper.init([])
    end
  end
end
