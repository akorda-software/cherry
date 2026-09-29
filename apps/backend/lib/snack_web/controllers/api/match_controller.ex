defmodule SnackWeb.Controllers.Api.MatchController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias Snack.Dating.Inbox
  alias SnackWeb.ChatJSON

  @doc """
  Matches visibles (activos, sin caducar, sin bloqueos, cuentas vivas) con foto,
  último mensaje y no leídos, por actividad reciente.
  """
  def index(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      matches = Inbox.list(profile.id)
      json(conn, %{matches: Enum.map(matches, &ChatJSON.match_summary(conn, &1))})
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

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
