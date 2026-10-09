defmodule SnackWeb.Controllers.Api.ProfileController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias SnackWeb.ChangesetJSON
  alias SnackWeb.OwnProfileJSON

  def show(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      profile =
        profile
        |> Snack.Repo.preload([:photos, :tags, :blocked_tags, :discovery_preference, :location])

      json(conn, %{
        profile: OwnProfileJSON.profile(conn, profile),
        completeness: Dating.profile_complete?(profile)
      })
    else
      json(conn, %{profile: nil, completeness: false})
    end
  end

  def update(conn, params) do
    user = conn.assigns.current_user

    with {:ok, updated} <- Dating.upsert_profile_for_user(user.id, params),
         {:ok, updated} <- Dating.sync_completed_profile_state(updated) do
      updated =
        Snack.Repo.preload(updated, [
          :photos,
          :tags,
          :blocked_tags,
          :discovery_preference,
          :location
        ])

      json(conn, %{profile: OwnProfileJSON.profile(conn, updated)})
    else
      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: ChangesetJSON.errors(changeset)})
    end
  end

  def complete(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.complete_profile(profile) do
        {:ok, completed} ->
          completed =
            Snack.Repo.preload(completed, [
              :photos,
              :tags,
              :blocked_tags,
              :discovery_preference,
              :location
            ])

          json(conn, %{
            profile: OwnProfileJSON.profile(conn, completed),
            onboardingRequired: false
          })

        {:error, %{error: :profile_incomplete} = reason} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{
            error: "profile_incomplete",
            missing: Enum.map(reason.missing, &Atom.to_string/1),
            nextOnboardingStep: reason.next_onboarding_step
          })
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end
end
