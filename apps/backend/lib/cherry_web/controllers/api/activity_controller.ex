defmodule CherryWeb.Controllers.Api.ActivityController do
  use CherryWeb, :controller

  alias Cherry.Dating.Social

  @doc "Contadores para los badges de las pestañas (`ActivitySummary`)."
  def summary(%{assigns: %{current_user: %{suspended_at: %DateTime{}}}} = conn, _params) do
    json(conn, %{receivedLikesCount: 0, newMatchesCount: 0, unreadConversationsCount: 0})
  end

  def summary(conn, _params) do
    case conn.assigns.current_profile do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})

      profile ->
        summary = Social.activity_summary(profile)

        json(conn, %{
          receivedLikesCount: summary.received_likes_count,
          newMatchesCount: summary.new_matches_count,
          unreadConversationsCount: summary.unread_conversations_count
        })
    end
  end
end
