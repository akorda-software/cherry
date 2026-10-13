defmodule CherryWeb.Controllers.Api.SettingsController do
  use CherryWeb, :controller

  alias Cherry.Dating

  def pause(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.pause_profile(profile) do
        {:ok, _} ->
          json(conn, %{ok: true})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def unpause(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.unpause_profile(profile) do
        {:ok, updated_profile} ->
          Dating.set_profile_complete(updated_profile)
          json(conn, %{ok: true})

        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def delete_account(conn, _params) do
    case Cherry.Accounts.delete_account(conn.assigns.current_user) do
      {:ok, _} ->
        json(conn, %{ok: true})

      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
    end
  end

  defp format_errors(changeset), do: CherryWeb.ChangesetJSON.errors(changeset)
end
