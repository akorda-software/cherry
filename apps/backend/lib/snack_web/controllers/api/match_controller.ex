defmodule SnackWeb.Controllers.Api.MatchController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias Snack.Dating.Inbox
  alias SnackWeb.ChatJSON

  @doc """
  Matches visibles (activos, sin caducar, sin bloqueos, cuentas vivas) con foto,
  último mensaje y no leídos, por actividad reciente.
  """
  def index(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      with {:ok, limit} <- SnackWeb.Pagination.limit(params, 50),
           {:ok, page} <- Inbox.list_page(profile.id, limit: limit, cursor: params["cursor"]) do
        json(conn, %{
          matches: Enum.map(page.entries, &ChatJSON.match_summary(conn, &1)),
          nextCursor: page.next_cursor
        })
      else
        {:error, reason} -> conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
      end
    else
      profile_not_found(conn)
    end
  end

  def for_conversation(conn, %{"id" => conversation_id}) do
    if profile = conn.assigns.current_profile do
      case Inbox.get_entry(conversation_id, profile.id) do
        {:ok, entry} -> json(conn, %{match: ChatJSON.match_summary(conn, entry)})
        {:error, reason} -> conn |> put_status(:forbidden) |> json(%{error: reason})
      end
    else
      profile_not_found(conn)
    end
  end

  def unmatch(conn, %{"id" => match_id}) do
    profile = conn.assigns.current_profile

    with %{} <- profile,
         {:ok, match_id} <- Ecto.UUID.cast(match_id),
         %Dating.Match{} = match <- Dating.get_match(match_id),
         true <- Dating.Match.other_profile(match, profile.id) != nil do
      case Dating.unmatch(match.id) do
        {:ok, _match} ->
          json(conn, %{ok: true})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      nil when is_nil(profile) -> profile_not_found(conn)
      false -> conn |> put_status(:forbidden) |> json(%{error: "not_participant"})
      _not_found -> conn |> put_status(:not_found) |> json(%{error: "match_not_found"})
    end
  end

  defp profile_not_found(conn) do
    conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})
  end

  defp format_errors(changeset), do: SnackWeb.ChangesetJSON.errors(changeset)
end
