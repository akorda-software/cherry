defmodule CherryWeb.Controllers.Api.MatchController do
  use CherryWeb, :controller

  alias Cherry.Dating

  def index(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      matches = Dating.list_matches(profile.id)
      json(conn, %{matches: Enum.map(matches, &serialize_match(&1, profile.id))})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def unmatch(conn, %{"id" => match_id}) do
    profile = conn.assigns.current_profile

    if profile do
      match = Dating.get_match(match_id)

      if match && Dating.Match.other_profile(match, profile.id) do
        case Dating.unmatch(match_id) do
          {:ok, _} ->
            json(conn, %{ok: true})

          {:error, changeset} ->
            conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
        end
      else
        conn
        |> put_status(:forbidden)
        |> json(%{error: "not_participant"})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  defp serialize_match(match, viewer_profile_id) do
    other_id = Dating.Match.other_profile(match, viewer_profile_id)
    other = Dating.get_profile(other_id)

    %{
      id: match.id,
      matchedAt: match.matched_at,
      expiresAt: match.expires_at,
      firstMessageAt: match.first_message_at,
      otherProfile: %{
        id: other_id,
        displayName: other && other.display_name,
        age: other && Cherry.Dating.Profile.age(other)
      }
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
