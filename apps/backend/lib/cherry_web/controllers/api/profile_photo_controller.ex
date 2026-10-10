defmodule CherryWeb.Controllers.Api.ProfilePhotoController do
  use CherryWeb, :controller

  alias Cherry.Dating
  alias CherryWeb.ChangesetJSON
  alias CherryWeb.OwnProfileJSON

  def index(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      photos = Dating.list_photos(profile.id)
      json(conn, %{photos: Enum.map(photos, &OwnProfileJSON.photo(conn, &1))})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def create_upload_intent(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.create_photo_upload_intent(profile, params) do
        {:ok, upload} ->
          json(conn, OwnProfileJSON.upload_intent(conn, upload))

        {:error, :storage_not_configured} ->
          conn
          |> put_status(:service_unavailable)
          |> json(%{error: "storage_not_configured"})

        {:error, :too_many_photos} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_photos"})

        {:error, reason} when reason in [:too_many_upload_intents, :upload_rate_limited] ->
          conn
          |> put_status(:too_many_requests)
          |> json(%{error: Atom.to_string(reason)})

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

  def complete_upload(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.complete_photo_upload(profile, params) do
        {:ok, photo} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{photo: OwnProfileJSON.photo(conn, photo)})

        {:error, reason} when reason in [:storage_not_configured, :storage_unavailable] ->
          conn |> put_status(:service_unavailable) |> json(%{error: reason})

        {:error, :upload_intent_not_found} ->
          conn
          |> put_status(:not_found)
          |> json(%{error: "upload_intent_not_found"})

        {:error, reason}
        when reason in [
               :upload_intent_completed,
               :upload_intent_expired,
               :upload_url_mismatch,
               :upload_content_type_mismatch,
               :upload_object_not_found,
               :upload_object_changed,
               :upload_size_mismatch,
               :upload_invalid_image,
               :too_many_photos,
               :photo_position_taken
             ] ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: Atom.to_string(reason)})

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

  def delete(conn, %{"id" => photo_id}) do
    profile = conn.assigns.current_profile

    if profile do
      photo =
        case Ecto.UUID.cast(photo_id) do
          {:ok, id} -> Cherry.Repo.get(Cherry.Dating.ProfilePhoto, id)
          :error -> nil
        end

      if photo && photo.profile_id == profile.id do
        Dating.delete_photo(photo)
        Dating.sync_completed_profile_state(profile)
        json(conn, %{ok: true})
      else
        conn
        |> put_status(:not_found)
        |> json(%{error: "photo_not_found"})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def reorder(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.reorder_photos(profile.id, Map.get(params, "photoIds")) do
        {:ok, photos} ->
          json(conn, %{photos: Enum.map(photos, &OwnProfileJSON.photo(conn, &1))})

        {:error, :invalid_photo_ids} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "invalid_photo_ids"})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end
end
