defmodule SnackWeb.Controllers.Api.ProfileTagController do
  use SnackWeb, :controller

  alias Snack.Dating
  alias SnackWeb.ChangesetJSON
  alias SnackWeb.DatingJSON

  def get_tags(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      tags = Dating.get_profile_tags(profile.id)
      json(conn, %{tags: Enum.map(tags, &DatingJSON.tag/1)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def set_tags(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.set_profile_tags(profile.id, tag_ids_param(params)) do
        {:ok, _} ->
          Dating.sync_completed_profile_state(profile)
          tags = Dating.get_profile_tags(profile.id)
          json(conn, %{tags: Enum.map(tags, &DatingJSON.tag/1)})

        {:error, :too_many_tags} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_tags"})

        {:error, reason} ->
          tag_update_error(conn, reason)
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def get_blocked_tags(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      tags = Dating.get_profile_blocked_tags(profile.id)
      json(conn, %{blockedTags: Enum.map(tags, &DatingJSON.tag/1)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def set_blocked_tags(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.set_profile_blocked_tags(profile.id, tag_ids_param(params)) do
        {:ok, _} ->
          tags = Dating.get_profile_blocked_tags(profile.id)
          json(conn, %{blockedTags: Enum.map(tags, &DatingJSON.tag/1)})

        {:error, :too_many_blocked_tags} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_blocked_tags"})

        {:error, reason} ->
          tag_update_error(conn, reason)
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  defp tag_ids_param(params), do: Map.get(params, "tag_ids", Map.get(params, "tagIds"))

  defp tag_update_error(conn, {code, tag_ids}) when code in [:invalid_tags, :tag_conflict] do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: Atom.to_string(code), tagIds: tag_ids})
  end

  defp tag_update_error(conn, %Ecto.Changeset{} = changeset) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: ChangesetJSON.errors(changeset)})
  end
end
