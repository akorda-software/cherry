defmodule SnackWeb.Controllers.Api.ProfileLocationController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias SnackWeb.ChangesetJSON

  def update(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      attrs = Map.put_new(params, "recorded_at", DateTime.utc_now())

      # Only latitude/longitude, snapped to the grid and throttled (see
      # `Dating.update_client_location/2`).
      case Dating.update_client_location(profile.id, attrs) do
        {:ok, _} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{ok: true})

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
