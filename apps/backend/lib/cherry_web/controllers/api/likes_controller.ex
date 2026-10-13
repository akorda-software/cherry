defmodule CherryWeb.Controllers.Api.LikesController do
  use CherryWeb, :controller

  alias Cherry.Dating.ProfileCards
  alias Cherry.Dating.Social
  alias CherryWeb.ProfileCardJSON

  @doc "Likes recibidos pendientes (visibles y gratis, D-2026-09-29)."
  def received(conn, params) do
    profile = conn.assigns.current_profile

    with %{} <- profile,
         {:ok, limit} <- parse_limit(params),
         {:ok, %{likes: likes, next_cursor: next_cursor}} <-
           Social.received_likes(profile, limit: limit, cursor: Map.get(params, "cursor")) do
      ids = Enum.map(likes, & &1.profile_id)
      rows = ProfileCards.rows(profile.id, ids)
      media = ProfileCards.load_media(profile.id, ids)

      json(conn, %{
        likes:
          for %{profile_id: id, liked_at: liked_at} <- likes, row = rows[id], row != nil do
            %{likedAt: liked_at, profile: ProfileCardJSON.card(conn, row, media)}
          end,
        nextCursor: next_cursor
      })
    else
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
    end
  end

  defp parse_limit(params) do
    case Map.get(params, "limit") do
      nil ->
        {:ok, Social.likes_default_limit()}

      value ->
        with {:ok, limit} <- CherryWeb.Pagination.limit(%{"limit" => value}, nil),
             true <- limit <= Social.likes_max_limit() do
          {:ok, limit}
        else
          _invalid -> {:error, :invalid_limit}
        end
    end
  end
end
