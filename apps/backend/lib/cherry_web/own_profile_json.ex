defmodule CherryWeb.OwnProfileJSON do
  @moduledoc "Serializes the current profile and its preloaded associations for the API."

  alias CherryWeb.DatingJSON
  alias CherryWeb.MediaUrl

  def profile(conn, %Cherry.Dating.Profile{} = profile) do
    %{
      id: profile.id,
      displayName: profile.display_name,
      birthDate: profile.birth_date,
      age: Cherry.Dating.Profile.age(profile),
      gender: profile.gender,
      lookingFor: profile.looking_for || [],
      # Deprecated: first intent, for app builds before multi-intent.
      whatIAmLookingFor: CherryWeb.ProfileCardJSON.legacy_intent(profile.looking_for),
      bio: profile.bio,
      isComplete: profile.is_complete,
      isPaused: profile.is_paused,
      isDiscoverable: profile.is_discoverable,
      hasLocation:
        case profile.location do
          %Cherry.Dating.ProfileLocation{} -> true
          _none -> false
        end,
      photos:
        (profile.photos || [])
        |> Enum.filter(& &1.is_active)
        |> Enum.sort_by(& &1.position)
        |> Enum.map(&photo(conn, &1)),
      tags: Enum.map(profile.tags || [], &tag/1),
      blockedTags: Enum.map(profile.blocked_tags || [], &tag/1),
      discoveryPreferences: discovery_preference(profile.discovery_preference),
      insertedAt: profile.inserted_at,
      updatedAt: profile.updated_at
    }
  end

  def profile(_conn, nil), do: nil

  def discovery_preference(%Cherry.Dating.DiscoveryPreference{} = pref) do
    %{
      ageMin: pref.age_min,
      ageMax: pref.age_max,
      distanceKm: pref.distance_km,
      showMen: pref.show_men,
      showWomen: pref.show_women,
      showNonBinary: pref.show_non_binary,
      compatibleOnly: pref.compatible_only,
      expandDistance: pref.expand_distance,
      discoveryMode: pref.discovery_mode
    }
  end

  def discovery_preference(nil), do: nil

  def photo(conn, %Cherry.Dating.ProfilePhoto{} = photo),
    do: DatingJSON.own_photo(conn, photo)

  # Local storage returns relative upload/public paths; the API always answers
  # with absolute URLs for the host the client used (or PUBLIC_BASE_URL).
  def upload_intent(conn, upload) do
    %{
      storageKey: upload.storage_key,
      uploadUrl: MediaUrl.absolute(conn, upload.upload_url),
      publicUrl: MediaUrl.absolute(conn, upload.public_url),
      method: upload.method,
      headers: upload.headers,
      expiresAt: upload.expires_at,
      maxBytes: upload.max_bytes
    }
  end

  defp tag(%Cherry.Dating.Tag{} = tag), do: DatingJSON.tag(tag)
end
