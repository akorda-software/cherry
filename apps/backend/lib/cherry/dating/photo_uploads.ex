defmodule Cherry.Dating.PhotoUploads do
  @moduledoc "Signed photo upload intents, quotas and verified completion."

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.Profile
  alias Cherry.Dating.ProfilePhoto
  alias Cherry.Dating.ProfilePhotoUploadIntent
  alias Cherry.Storage

  @max_live_upload_intents 4
  @max_upload_intents_per_hour 20

  @doc """
  Creates a signed photo upload intent. Besides the photo limit, a profile may
  hold at most #{@max_live_upload_intents} live (unexpired, uncompleted) intents
  (`:too_many_upload_intents`) and create at most #{@max_upload_intents_per_hour}
  per hour (`:upload_rate_limited`). Keys are random (`photos/<random>.<ext>`).
  """
  def create_photo_upload_intent(%Profile{} = profile, attrs) do
    with {:ok, upload_config} <- Storage.upload_config(),
         {:ok, upload_attrs} <- normalize_photo_upload_attrs(attrs),
         storage_key = Storage.new_photo_key(upload_attrs.content_type),
         {:ok, signed_upload} <- Storage.presign_put(storage_key, upload_attrs.content_type) do
      # Signing happens before the transaction; storage never holds the row
      # lock. Quotas and insertion share the lock with photo completion/reorder.
      Repo.transaction(fn ->
        Repo.one!(from p in Profile, where: p.id == ^profile.id, lock: "FOR UPDATE")

        with :ok <- validate_active_photo_limit(profile.id),
             :ok <- validate_upload_intent_quota(profile.id),
             {:ok, intent} <-
               insert_photo_upload_intent(profile.id, upload_attrs, signed_upload, upload_config) do
          Map.put(signed_upload, :intent, intent)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def complete_photo_upload(%Profile{} = profile, attrs) do
    storage_key = upload_attr(attrs, :storage_key, "storage_key", "storageKey")

    with %ProfilePhotoUploadIntent{} = intent <- get_photo_upload_intent(profile.id, storage_key),
         :ok <- validate_upload_completion(intent, attrs),
         :ok <- validate_active_photo_limit(profile.id),
         :ok <- validate_photo_position_available(profile.id, intent.position),
         :ok <- Storage.verify_upload(intent),
         # Out of the non-public pending area. If the transaction below fails,
         # the published object is removed by the sweeper when the intent
         # expires uncompleted (`Cherry.Dating.PhotoStorage`).
         :ok <- Storage.publish_upload(intent) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Ecto.Multi.new()
      |> Ecto.Multi.run(:lock, fn repo, _ ->
        repo.one!(from p in Profile, where: p.id == ^profile.id, lock: "FOR UPDATE")

        current_intent =
          repo.one!(
            from i in ProfilePhotoUploadIntent, where: i.id == ^intent.id, lock: "FOR UPDATE"
          )

        with :ok <- validate_upload_completion(current_intent, attrs),
             :ok <- validate_active_photo_limit(profile.id),
             :ok <- validate_photo_position_available(profile.id, intent.position) do
          {:ok, :locked}
        end
      end)
      |> Ecto.Multi.insert(
        :photo,
        ProfilePhoto.changeset(%ProfilePhoto{}, %{
          profile_id: profile.id,
          storage_key: intent.storage_key,
          url: intent.public_url,
          position: intent.position,
          is_active: true
        })
      )
      |> Ecto.Multi.update(
        :intent,
        ProfilePhotoUploadIntent.complete_changeset(intent, %{completed_at: now})
      )
      |> Repo.transaction()
      |> case do
        {:ok, %{photo: photo}} -> {:ok, photo}
        {:error, _step, changeset, _changes} -> {:error, changeset}
      end
    else
      nil -> {:error, :upload_intent_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp normalize_photo_upload_attrs(attrs) do
    attrs = %{
      position: upload_attr(attrs, :position, "position"),
      content_type: upload_attr(attrs, :content_type, "content_type", "contentType"),
      size_bytes: upload_attr(attrs, :size_bytes, "size_bytes", "sizeBytes")
    }

    with {:ok, position} <- parse_integer(attrs.position),
         {:ok, size_bytes} <- parse_integer(attrs.size_bytes),
         content_type when is_binary(content_type) <- attrs.content_type do
      {:ok, %{position: position, content_type: content_type, size_bytes: size_bytes}}
    else
      _error -> {:error, invalid_photo_upload_changeset()}
    end
  end

  defp upload_attr(attrs, atom_key, string_key),
    do: Map.get(attrs, string_key) || Map.get(attrs, atom_key)

  defp upload_attr(attrs, atom_key, string_key, camel_key) do
    Map.get(attrs, camel_key) || upload_attr(attrs, atom_key, string_key)
  end

  defp parse_integer(value) when is_integer(value), do: {:ok, value}

  defp parse_integer(value) when is_binary(value) do
    case Integer.parse(value) do
      {integer, ""} -> {:ok, integer}
      _value -> :error
    end
  end

  defp parse_integer(_value), do: :error

  defp validate_upload_intent_quota(profile_id) do
    now = DateTime.utc_now()
    hour_ago = DateTime.add(now, -3600, :second)

    %{live: live, recent: recent} =
      Repo.one(
        from(i in ProfilePhotoUploadIntent,
          where: i.profile_id == ^profile_id,
          select: %{
            live: filter(count(i.id), is_nil(i.completed_at) and i.expires_at > ^now),
            recent: filter(count(i.id), i.inserted_at > ^hour_ago)
          }
        )
      )

    cond do
      live >= @max_live_upload_intents -> {:error, :too_many_upload_intents}
      recent >= @max_upload_intents_per_hour -> {:error, :upload_rate_limited}
      true -> :ok
    end
  end

  defp insert_photo_upload_intent(profile_id, upload_attrs, signed_upload, upload_config) do
    %ProfilePhotoUploadIntent{}
    |> ProfilePhotoUploadIntent.changeset(
      %{
        profile_id: profile_id,
        storage_key: signed_upload.storage_key,
        public_url: signed_upload.public_url,
        position: upload_attrs.position,
        content_type: upload_attrs.content_type,
        size_bytes: upload_attrs.size_bytes,
        expires_at: signed_upload.expires_at
      },
      max_upload_bytes: upload_config.max_upload_bytes,
      allowed_content_types: upload_config.allowed_content_types
    )
    |> Repo.insert()
  end

  defp get_photo_upload_intent(_profile_id, nil), do: nil

  defp get_photo_upload_intent(profile_id, storage_key) do
    Repo.get_by(ProfilePhotoUploadIntent, profile_id: profile_id, storage_key: storage_key)
  end

  defp validate_upload_completion(%ProfilePhotoUploadIntent{} = intent, attrs) do
    cond do
      intent.completed_at != nil ->
        {:error, :upload_intent_completed}

      DateTime.compare(intent.expires_at, DateTime.utc_now()) == :lt ->
        {:error, :upload_intent_expired}

      !public_url_matches?(
        upload_attr(attrs, :public_url, "public_url", "publicUrl"),
        intent.public_url
      ) ->
        {:error, :upload_url_mismatch}

      !upload_attr_matches?(
        attrs,
        :content_type,
        "content_type",
        "contentType",
        intent.content_type
      ) ->
        {:error, :upload_content_type_mismatch}

      true ->
        :ok
    end
  end

  defp upload_attr_matches?(attrs, atom_key, string_key, camel_key, expected) do
    case upload_attr(attrs, atom_key, string_key, camel_key) do
      nil -> true
      value -> value == expected
    end
  end

  # Local storage keeps a relative URL (`/uploads/...`) that the API returns as
  # absolute for whichever host the client used, so the absolute form echoed back
  # by the client is accepted when its path is the stored one.
  defp public_url_matches?(nil, _expected), do: true
  defp public_url_matches?(value, value), do: true

  defp public_url_matches?(value, "/" <> _ = expected) when is_binary(value) do
    case URI.parse(value) do
      %URI{scheme: scheme, path: ^expected, query: nil} when scheme in ["http", "https"] -> true
      _other -> false
    end
  end

  defp public_url_matches?(_value, _expected), do: false

  defp validate_active_photo_limit(profile_id) do
    if active_photo_count(profile_id) < 4 do
      :ok
    else
      {:error, :too_many_photos}
    end
  end

  defp validate_photo_position_available(profile_id, position) do
    exists? =
      Repo.exists?(
        from(photo in ProfilePhoto,
          where:
            photo.profile_id == ^profile_id and photo.position == ^position and
              photo.is_active == true
        )
      )

    if exists?, do: {:error, :photo_position_taken}, else: :ok
  end

  defp active_photo_count(profile_id) do
    ProfilePhoto
    |> where([photo], photo.profile_id == ^profile_id and photo.is_active == true)
    |> Repo.aggregate(:count, :id)
  end

  defp invalid_photo_upload_changeset do
    %ProfilePhotoUploadIntent{}
    |> ProfilePhotoUploadIntent.changeset(%{})
  end
end
