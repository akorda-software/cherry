defmodule SnackWeb.Controllers.Api.SettingsController do
  use SnackWeb, :controller

  alias Snack.Dating

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
        {:ok, _} ->
          Dating.set_profile_complete(profile)
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
    profile = conn.assigns.current_profile

    if profile do
      case Dating.delete_profile(profile) do
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

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r/%{(\w+)}/, msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end
end
