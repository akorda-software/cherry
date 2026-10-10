defmodule CherryWeb.Controllers.Api.DiscoveryPreferenceController do
  use CherryWeb, :controller

  alias Cherry.Dating
  alias CherryWeb.ChangesetJSON
  alias CherryWeb.OwnProfileJSON

  def show(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      pref = Dating.get_discovery_preference(profile.id)
      json(conn, %{discoveryPreferences: OwnProfileJSON.discovery_preference(pref)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def update(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.upsert_discovery_preference(profile.id, params) do
        {:ok, pref} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{discoveryPreferences: OwnProfileJSON.discovery_preference(pref)})

        {:error, changeset} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{errors: ChangesetJSON.errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end
end
