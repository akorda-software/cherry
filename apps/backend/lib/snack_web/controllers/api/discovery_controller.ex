defmodule SnackWeb.Controllers.Api.DiscoveryController do
  use SnackWeb, :controller

  alias Snack.Dating

  def feed(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      if profile.is_complete && profile.is_discoverable && !profile.is_paused && is_nil(profile.deleted_at) do
        limit = String.to_integer(Map.get(params, "limit", "20"))
        cursor = parse_cursor(Map.get(params, "cursor"))

        case Dating.discovery_feed(profile.id, limit: limit, cursor: cursor) do
          {:ok, %{profiles: profiles, next_cursor: next_cursor}} ->
            json(conn, %{
              profiles: Enum.map(profiles, &serialize_card/1),
              nextCursor: format_cursor(next_cursor)
            })
        end
      else
        conn
        |> put_status(:forbidden)
        |> json(%{error: "profile_incomplete", reason: "complete your profile to browse"})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def create_action(conn, %{"target_profile_id" => target_id, "action_type" => action_type}) do
    profile = conn.assigns.current_profile

    if profile do
      attrs = %{
        actor_profile_id: profile.id,
        target_profile_id: target_id,
        action_type: action_type
      }

      case Dating.record_swipe(attrs) do
        {:ok, %{swipe: _swipe, match: nil}} ->
          json(conn, %{matchCreated: false})

        {:ok, %{swipe: _swipe, match: match}} ->
          json(conn, %{
            matchCreated: true,
            match: serialize_match(match, profile.id)
          })

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  defp serialize_card(candidate) do
    %{
      id: candidate.id,
      displayName: candidate.display_name,
      age: Snack.Dating.Profile.age(%{birth_date: candidate.birth_date}),
      bio: candidate.bio,
      gender: candidate.gender,
      whatIAmLookingFor: candidate.what_i_am_looking_for,
      distanceKm: round((candidate.distance_m || 0) / 1000),
      score: candidate.score,
      sharedTagsCount: candidate.shared_tags_count
    }
  end

  defp serialize_match(match, viewer_profile_id) do
    other_id = Dating.Match.other_profile(match, viewer_profile_id)
    other = Dating.get_profile(other_id)

    %{
      id: match.id,
      matchedAt: match.matched_at,
      expiresAt: match.expires_at,
      otherProfile: %{
        id: other_id,
        displayName: other && other.display_name,
        age: other && Snack.Dating.Profile.age(other)
      }
    }
  end

  defp parse_cursor(nil), do: nil
  defp parse_cursor(str) do
    case DateTime.from_iso8601(str) do
      {:ok, dt, _} -> dt
      _ -> nil
    end
  end

  defp format_cursor(nil), do: nil
  defp format_cursor(dt), do: DateTime.to_iso8601(dt)

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
