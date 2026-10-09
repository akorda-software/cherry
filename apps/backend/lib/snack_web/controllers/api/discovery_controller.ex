defmodule SnackWeb.Controllers.Api.DiscoveryController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias Snack.Dating.ProfileCards
  alias Snack.Dating.Social
  alias SnackWeb.ChatJSON
  alias SnackWeb.ProfileCardJSON

  def feed(conn, params) do
    profile = conn.assigns.current_profile

    case profile && Social.viewer_status(profile) do
      nil ->
        profile_not_found(conn)

      {:error, reason} ->
        inactive_viewer(conn, profile, reason)

      :ok ->
        with {:ok, limit} <- SnackWeb.Pagination.limit(params, 20),
             {:ok, %{profiles: rows, next_cursor: next_cursor}} <-
               Dating.discovery_feed(profile.id, limit: limit, cursor: Map.get(params, "cursor")) do
          media = ProfileCards.load_media(profile.id, Enum.map(rows, & &1.id))

          json(conn, %{
            profiles: Enum.map(rows, &ProfileCardJSON.card(conn, &1, media)),
            nextCursor: next_cursor
          })
        else
          {:error, reason} -> unprocessable(conn, reason)
        end
    end
  end

  def create_action(conn, %{"target_profile_id" => target_id, "action_type" => action_type}) do
    profile = conn.assigns.current_profile

    if profile do
      case Social.swipe(profile, target_id, action_type) do
        {:ok, %{match: nil}} ->
          json(conn, %{matchCreated: false})

        {:ok, %{match: match}} ->
          json(conn, %{matchCreated: true, match: serialize_match(conn, match, profile.id)})

        {:error, :profile_not_found} ->
          profile_not_found(conn)

        {:error, reason} when reason in [:profile_paused, :profile_incomplete] ->
          inactive_viewer(conn, profile, reason)

        {:error, :already_swiped} ->
          conn |> put_status(:conflict) |> json(%{error: "already_swiped"})

        {:error, reason} when is_atom(reason) ->
          unprocessable(conn, reason)

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{errors: format_errors(changeset)})
      end
    else
      profile_not_found(conn)
    end
  end

  def create_action(conn, _params) do
    if conn.assigns.current_profile do
      unprocessable(conn, :invalid_params)
    else
      profile_not_found(conn)
    end
  end

  @doc """
  Deshace el último «no». Si el perfil ya no es visible (pausa, bloqueo,
  filtros...), el deshacer se aplica igualmente y `profile` es `null`.
  """
  def undo(conn, _params) do
    profile = conn.assigns.current_profile

    with %{} <- profile,
         {:ok, target_id} <- Social.undo_last_dislike(profile) do
      card =
        case Social.public_profile(profile, target_id) do
          {:ok, %{row: row, media: media}} -> ProfileCardJSON.card(conn, row, media)
          {:error, :profile_not_found} -> nil
        end

      json(conn, %{undone: true, profile: card})
    else
      nil -> profile_not_found(conn)
      {:error, :nothing_to_undo} -> unprocessable(conn, :nothing_to_undo)
      {:error, reason} -> inactive_viewer(conn, profile, reason)
    end
  end

  defp serialize_match(conn, match, viewer_profile_id) do
    other_id = Dating.Match.other_profile(match, viewer_profile_id)
    other = Dating.get_profile(other_id)
    conversation = Snack.Repo.get_by(Dating.Conversation, match_id: match.id)
    photo = other && List.first(Dating.list_photos(other.id))

    %{
      id: match.id,
      conversationId: conversation && conversation.id,
      matchedAt: match.matched_at,
      expiresAt: match.expires_at,
      otherProfile:
        if other do
          ChatJSON.profile_summary(conn, other, photo && photo.url)
        else
          %{id: other_id, displayName: nil, age: nil, photoUrl: nil}
        end
    }
  end

  # Same 403 bodies as the feed: swipes, undo and the feed need an active viewer.
  defp inactive_viewer(conn, _profile, :profile_paused) do
    conn
    |> put_status(:forbidden)
    |> json(%{
      error: "profile_paused",
      reason: "your profile is paused",
      onboardingRequired: false,
      nextOnboardingStep: nil
    })
  end

  defp inactive_viewer(conn, profile, :profile_incomplete) do
    {_complete?, next_step} = SnackWeb.Onboarding.state(profile)

    conn
    |> put_status(:forbidden)
    |> json(%{
      error: "profile_incomplete",
      reason: "complete your profile to browse",
      onboardingRequired: true,
      nextOnboardingStep: next_step
    })
  end

  defp profile_not_found(conn) do
    conn |> put_status(:not_found) |> json(%{error: "profile_not_found"})
  end

  defp unprocessable(conn, reason) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: reason})
  end

  defp format_errors(changeset), do: SnackWeb.ChangesetJSON.errors(changeset)
end
