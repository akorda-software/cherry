defmodule CherryWeb.Controllers.Api.ProfileController do
  use CherryWeb, :controller

  alias Cherry.Dating

  def show(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      profile =
        profile
        |> Cherry.Repo.preload([:photos, :tags, :blocked_tags, :discovery_preference, :location])

      json(conn, %{
        profile: serialize_profile(profile),
        completeness: Dating.profile_complete?(profile)
      })
    else
      json(conn, %{profile: nil, completeness: false})
    end
  end

  def update(conn, params) do
    user = conn.assigns.current_user

    case Dating.upsert_profile_for_user(user.id, params) do
      {:ok, updated} ->
        Dating.sync_completed_profile_state(updated)

        updated =
          Cherry.Repo.preload(updated, [
            :photos,
            :tags,
            :blocked_tags,
            :discovery_preference,
            :location
          ])

        json(conn, %{profile: serialize_profile(updated)})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  def complete(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.complete_profile(profile) do
        {:ok, completed} ->
          completed =
            Cherry.Repo.preload(completed, [
              :photos,
              :tags,
              :blocked_tags,
              :discovery_preference,
              :location
            ])

          json(conn, %{profile: serialize_profile(completed), onboardingRequired: false})

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

  def show_discovery_preferences(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      pref = Dating.get_discovery_preference(profile.id)
      json(conn, %{discoveryPreferences: serialize_discovery_preference(pref)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def update_discovery_preferences(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.upsert_discovery_preference(profile.id, params) do
        {:ok, pref} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{discoveryPreferences: serialize_discovery_preference(pref)})

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

  def list_photos(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      photos = Dating.list_photos(profile.id)
      json(conn, %{photos: Enum.map(photos, &serialize_photo/1)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def create_photo_upload_intent(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.create_photo_upload_intent(profile, params) do
        {:ok, upload} ->
          json(conn, serialize_upload_intent(upload))

        {:error, :storage_not_configured} ->
          conn
          |> put_status(:service_unavailable)
          |> json(%{error: "storage_not_configured"})

        {:error, :too_many_photos} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_photos"})

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

  def complete_photo_upload(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.complete_photo_upload(profile, params) do
        {:ok, photo} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{photo: serialize_photo(photo)})

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
          |> json(%{errors: format_errors(changeset)})
      end
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def delete_photo(conn, %{"id" => photo_id}) do
    profile = conn.assigns.current_profile

    if profile do
      photo = Cherry.Repo.get(Cherry.Dating.ProfilePhoto, photo_id)

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

  def get_tags(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      tags = Dating.get_profile_tags(profile.id)
      json(conn, %{tags: Enum.map(tags, &serialize_tag/1)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def set_tags(conn, %{"tag_ids" => tag_ids}) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.set_profile_tags(profile.id, tag_ids) do
        {:ok, _} ->
          Dating.sync_completed_profile_state(profile)
          tags = Dating.get_profile_tags(profile.id)
          json(conn, %{tags: Enum.map(tags, &serialize_tag/1)})

        {:error, :too_many_tags} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_tags"})

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

  def get_blocked_tags(conn, _params) do
    profile = conn.assigns.current_profile

    if profile do
      tags = Dating.get_profile_blocked_tags(profile.id)
      json(conn, %{blockedTags: Enum.map(tags, &serialize_tag/1)})
    else
      conn
      |> put_status(:not_found)
      |> json(%{error: "profile_not_found"})
    end
  end

  def set_blocked_tags(conn, %{"tag_ids" => tag_ids}) do
    profile = conn.assigns.current_profile

    if profile do
      case Dating.set_profile_blocked_tags(profile.id, tag_ids) do
        {:ok, _} ->
          tags = Dating.get_profile_blocked_tags(profile.id)
          json(conn, %{blockedTags: Enum.map(tags, &serialize_tag/1)})

        {:error, :too_many_blocked_tags} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{error: "too_many_blocked_tags"})

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

  def update_location(conn, params) do
    profile = conn.assigns.current_profile

    if profile do
      attrs =
        params
        |> Map.put("profile_id", profile.id)
        |> Map.put_new("recorded_at", DateTime.utc_now())

      case Dating.upsert_location(attrs) do
        {:ok, _} ->
          Dating.sync_completed_profile_state(profile)
          json(conn, %{ok: true})

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

  defp serialize_profile(%Cherry.Dating.Profile{} = profile) do
    %{
      id: profile.id,
      displayName: profile.display_name,
      birthDate: profile.birth_date,
      age: Cherry.Dating.Profile.age(profile),
      gender: profile.gender,
      whatIAmLookingFor: profile.what_i_am_looking_for,
      bio: profile.bio,
      isComplete: profile.is_complete,
      isPaused: profile.is_paused,
      isDiscoverable: profile.is_discoverable,
      photos: Enum.map(profile.photos || [], &serialize_photo/1),
      tags: Enum.map(profile.tags || [], &serialize_tag/1),
      blockedTags: Enum.map(profile.blocked_tags || [], &serialize_tag/1),
      discoveryPreferences: serialize_discovery_preference(profile.discovery_preference),
      insertedAt: profile.inserted_at,
      updatedAt: profile.updated_at
    }
  end

  defp serialize_profile(nil), do: nil

  defp serialize_discovery_preference(%Cherry.Dating.DiscoveryPreference{} = pref) do
    %{
      ageMin: pref.age_min,
      ageMax: pref.age_max,
      distanceKm: pref.distance_km,
      showMen: pref.show_men,
      showWomen: pref.show_women,
      showNonBinary: pref.show_non_binary,
      compatibleOnly: pref.compatible_only,
      discoveryMode: pref.discovery_mode
    }
  end

  defp serialize_discovery_preference(nil), do: nil

  defp serialize_photo(%Cherry.Dating.ProfilePhoto{} = photo) do
    %{
      id: photo.id,
      storageKey: photo.storage_key,
      url: photo.url,
      position: photo.position,
      isActive: photo.is_active
    }
  end

  defp serialize_upload_intent(upload) do
    %{
      storageKey: upload.storage_key,
      uploadUrl: upload.upload_url,
      publicUrl: upload.public_url,
      method: upload.method,
      headers: upload.headers,
      expiresAt: upload.expires_at,
      maxBytes: upload.max_bytes
    }
  end

  defp serialize_tag(%Cherry.Dating.Tag{} = tag) do
    %{
      id: tag.id,
      slug: tag.slug,
      label: tag.label,
      category: tag.category
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
