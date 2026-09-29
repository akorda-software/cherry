defmodule Snack.Dating do
  @moduledoc """
  The Dating context. Manages profiles, discovery, swipes, matches,
  conversations, safety, and analytics for the dating experience.
  """

  import Ecto.Query
  import Ecto.Changeset, only: [add_error: 3]

  require Logger

  alias Snack.Repo

  alias Snack.Dating.Profile
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.ProfilePhotoUploadIntent
  alias Snack.Dating.Tag
  alias Snack.Dating.ProfileLocation
  alias Snack.Dating.SwipeAction
  alias Snack.Dating.Match
  alias Snack.Dating.Conversation
  alias Snack.Dating.Message
  alias Snack.Dating.UserBlock
  alias Snack.Dating.Report
  alias Snack.Dating.AnalyticsEvent
  alias Snack.Storage

  # ── Profiles ──────────────────────────────────────────────────────────

  @doc """
  Returns the list of all profiles.
  """
  def list_profiles do
    Repo.all(Profile)
  end

  @doc """
  Gets a single profile by id.
  """
  def get_profile(id) do
    Repo.get(Profile, id)
  end

  @doc """
  Gets a single profile by user_id.
  """
  def get_profile_by_user(user_id) do
    Repo.get_by(Profile, user_id: user_id)
  end

  @doc """
  Creates a profile.
  """
  def create_profile(attrs \\ %{}) do
    %Profile{}
    |> Profile.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Creates or updates the current user's draft profile during onboarding.
  """
  def upsert_profile_for_user(user_id, attrs \\ %{}) do
    attrs = put_user_id(attrs, user_id)

    case get_profile_by_user(user_id) do
      nil ->
        %Profile{}
        |> Profile.draft_changeset(attrs)
        |> Repo.insert()

      %Profile{} = profile ->
        update_profile(profile, attrs)
    end
  end

  @doc """
  Updates a profile's core fields.
  """
  def update_profile(%Profile{} = profile, attrs) do
    profile
    |> Profile.draft_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Soft-deletes a profile by setting `deleted_at`.
  """
  def delete_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{deleted_at: DateTime.utc_now(), is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking profile changes.
  """
  def change_profile(%Profile{} = profile, attrs \\ %{}) do
    Profile.changeset(profile, attrs)
  end

  def profile_completion_missing(%Profile{} = profile) do
    profile = Repo.preload(profile, [:photos, :tags, :discovery_preference, :location])

    strict = Application.get_env(:snack, :strict_profile_completion, true)

    base_checks = [
      {:display_name, present_string?(profile.display_name)},
      {:birth_date, valid_age?(profile)},
      {:gender, profile.gender in Profile.genders()},
      {:what_i_am_looking_for, profile.what_i_am_looking_for in Profile.relationship_intents()},
      {:bio, valid_bio?(profile.bio)},
      {:interested_in, valid_interested_in?(profile.discovery_preference)},
      {:discovery_preferences, valid_discovery_preferences?(profile.discovery_preference)},
      {:tags, valid_tag_count?(profile.tags)}
    ]

    extra_checks =
      if strict do
        [{:photos, valid_photo_count?(profile.photos)}, {:location, profile.location != nil}]
      else
        []
      end

    (base_checks ++ extra_checks)
    |> Enum.reject(fn {_field, valid?} -> valid? end)
    |> Enum.map(fn {field, _valid?} -> field end)
  end

  @doc """
  Checks whether a profile satisfies completeness rules.

  Rules:
  - 2–4 active photos
  - bio between 20 and 240 characters
  - discovery preferences present with at least one interested-in option
  - 1–8 positive tags
  - location present
  """
  def profile_complete?(%Profile{} = profile) do
    profile_completion_missing(profile) == []
  end

  @doc """
  Marks `is_complete` true if completeness rules pass.
  """
  def set_profile_complete(%Profile{} = profile) do
    complete = profile_complete?(profile)

    profile
    |> Profile.system_changeset(%{
      is_complete: complete,
      is_discoverable: complete and !profile.is_paused and is_nil(profile.deleted_at)
    })
    |> Repo.update()
  end

  def complete_profile(%Profile{} = profile) do
    missing = profile_completion_missing(profile)

    if missing == [] do
      profile
      |> Profile.system_changeset(%{
        is_complete: true,
        is_discoverable: !profile.is_paused and is_nil(profile.deleted_at),
        # First completion only: drives the discovery newcomer boost.
        completed_at: profile.completed_at || now()
      })
      |> Repo.update()
    else
      {:error,
       %{
         error: :profile_incomplete,
         missing: missing,
         next_onboarding_step: next_onboarding_step(missing)
       }}
    end
  end

  def sync_completed_profile_state(%Profile{is_complete: true} = profile) do
    set_profile_complete(profile)
  end

  def sync_completed_profile_state(%Profile{} = profile), do: {:ok, profile}

  @doc """
  Pauses a profile (sets `is_paused` true and `is_discoverable` false).
  """
  def pause_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{is_paused: true, is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Unpauses a profile (sets `is_paused` false).
  """
  def unpause_profile(%Profile{} = profile) do
    profile
    |> Profile.system_changeset(%{is_paused: false})
    |> Repo.update()
  end

  defp put_user_id(attrs, user_id) when is_map(attrs) do
    if Enum.any?(Map.keys(attrs), &is_binary/1) do
      Map.put(attrs, "user_id", user_id)
    else
      Map.put(attrs, :user_id, user_id)
    end
  end

  defp present_string?(value) when is_binary(value), do: String.trim(value) != ""
  defp present_string?(_value), do: false

  defp valid_bio?(value) when is_binary(value) do
    length = value |> String.trim() |> String.length()
    length >= 20 and length <= 240
  end

  defp valid_bio?(_value), do: false

  defp valid_age?(%Profile{} = profile) do
    case Profile.age(profile) do
      age when is_integer(age) -> age >= 18
      _age -> false
    end
  end

  defp valid_photo_count?(photos) when is_list(photos) do
    active_photos = Enum.count(photos, & &1.is_active)
    active_photos >= 2 and active_photos <= 4
  end

  defp valid_photo_count?(_photos), do: false

  defp valid_interested_in?(nil), do: false

  defp valid_interested_in?(pref) do
    pref.show_men or pref.show_women or pref.show_non_binary
  end

  defp valid_discovery_preferences?(nil), do: false

  defp valid_discovery_preferences?(pref) do
    valid_interested_in?(pref) and pref.age_min <= pref.age_max and
      pref.distance_km in [10, 25, 50, 100, 999_999]
  end

  defp valid_tag_count?(tags) when is_list(tags), do: length(tags) >= 1 and length(tags) <= 8
  defp valid_tag_count?(_tags), do: false

  defp next_onboarding_step([:display_name | _missing]), do: "name"
  defp next_onboarding_step([:birth_date | _missing]), do: "birth_date"
  defp next_onboarding_step([:gender | _missing]), do: "gender"
  defp next_onboarding_step([:what_i_am_looking_for | _missing]), do: "intent"
  defp next_onboarding_step([:bio | _missing]), do: "bio"
  defp next_onboarding_step([:photos | _missing]), do: "photos"
  defp next_onboarding_step([:interested_in | _missing]), do: "interested_in"
  defp next_onboarding_step([:discovery_preferences | _missing]), do: "discovery_preferences"
  defp next_onboarding_step([:tags | _missing]), do: "tags"
  defp next_onboarding_step([:location | _missing]), do: "location"
  defp next_onboarding_step(_missing), do: nil

  # ── Discovery Preferences ─────────────────────────────────────────────

  @doc """
  Gets discovery preferences for a profile.
  """
  def get_discovery_preference(profile_id) do
    Repo.get_by(DiscoveryPreference, profile_id: profile_id)
  end

  @doc """
  Inserts or updates discovery preferences for a profile.
  """
  def upsert_discovery_preference(profile_id, attrs) do
    case get_discovery_preference(profile_id) do
      nil ->
        %DiscoveryPreference{profile_id: profile_id}
        |> DiscoveryPreference.changeset(attrs)
        |> Repo.insert()

      pref ->
        pref
        |> DiscoveryPreference.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for discovery preference changes.
  """
  def change_discovery_preference(%DiscoveryPreference{} = pref, attrs \\ %{}) do
    DiscoveryPreference.changeset(pref, attrs)
  end

  # ── Photos ────────────────────────────────────────────────────────────

  @doc """
  Lists active photos for a profile, ordered by position.
  """
  def list_photos(profile_id) do
    ProfilePhoto
    |> where([p], p.profile_id == ^profile_id and p.is_active == true)
    |> order_by([p], p.position)
    |> Repo.all()
  end

  @doc """
  Creates a photo.
  """
  def create_photo(attrs \\ %{}) do
    %ProfilePhoto{}
    |> ProfilePhoto.changeset(attrs)
    |> Repo.insert()
  end

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
         :ok <- validate_active_photo_limit(profile.id),
         :ok <- validate_upload_intent_quota(profile.id),
         storage_key = Storage.new_photo_key(upload_attrs.content_type),
         {:ok, signed_upload} <- Storage.presign_put(storage_key, upload_attrs.content_type),
         {:ok, intent} <-
           insert_photo_upload_intent(profile.id, upload_attrs, signed_upload, upload_config) do
      {:ok, Map.put(signed_upload, :intent, intent)}
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
         # expires uncompleted (`Snack.Dating.PhotoStorage`).
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

  @doc """
  Deletes a photo: the row is kept inactive (`is_active` false) and the stored
  object is deleted physically right away (retried by the sweeper if storage
  fails, see `Snack.Dating.PhotoStorage`).
  """
  def delete_photo(%ProfilePhoto{} = photo) do
    photo
    |> ProfilePhoto.changeset(%{is_active: false})
    |> Repo.update()
    |> case do
      {:ok, photo} -> {:ok, Snack.Dating.PhotoStorage.purge_photo(photo)}
      error -> error
    end
  end

  @doc """
  Reorders the active photos of a profile. `ordered_photo_ids` must list every
  active photo exactly once; positions become 1..n in that order.
  """
  def reorder_photos(profile_id, ordered_photo_ids) when is_list(ordered_photo_ids) do
    Repo.transaction(fn ->
      # Serialises with uploads/deletes of the same profile.
      Repo.one!(from p in Profile, where: p.id == ^profile_id, lock: "FOR UPDATE")

      active_query =
        from(p in ProfilePhoto, where: p.profile_id == ^profile_id and p.is_active == true)

      active_ids = Repo.all(from p in active_query, select: p.id)

      if permutation?(ordered_photo_ids, active_ids) do
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        # Phase 1: park every active photo outside 1..4 so the partial unique
        # index on (profile_id, position) never sees a transient duplicate.
        Repo.update_all(active_query, inc: [position: 100])

        # Phase 2: final positions.
        ordered_photo_ids
        |> Enum.with_index(1)
        |> Enum.each(fn {photo_id, position} ->
          Repo.update_all(from(p in ProfilePhoto, where: p.id == ^photo_id),
            set: [position: position, updated_at: now]
          )
        end)

        list_photos(profile_id)
      else
        Repo.rollback(:invalid_photo_ids)
      end
    end)
  end

  def reorder_photos(_profile_id, _ordered_photo_ids), do: {:error, :invalid_photo_ids}

  defp permutation?(candidate_ids, expected_ids) do
    Enum.all?(candidate_ids, &is_binary/1) and length(candidate_ids) == length(expected_ids) and
      MapSet.new(candidate_ids) == MapSet.new(expected_ids)
  end

  # ── Tags ──────────────────────────────────────────────────────────────

  @doc """
  Lists all active tags in catalog order (`sort_order` is global and already
  groups categories in their display order).
  """
  def list_active_tags do
    Tag
    |> where([t], t.is_active == true)
    |> order_by([t], [t.sort_order, t.category, t.label])
    |> Repo.all()
  end

  @doc """
  Gets a single tag by id.
  """
  def get_tag(id) do
    Repo.get(Tag, id)
  end

  @doc """
  Creates a tag.
  """
  def create_tag(attrs \\ %{}) do
    %Tag{}
    |> Tag.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Replaces the positive tags on a profile (max 8, duplicates ignored).

  Errors: `:too_many_tags`; `{:invalid_tags, ids}` for unknown, malformed or
  inactive catalog IDs; `{:tag_conflict, ids}` for IDs the profile blocks.
  """
  def set_profile_tags(profile_id, tag_ids),
    do: replace_profile_tags(profile_id, tag_ids, :tags)

  @doc """
  Replaces the blocked tags on a profile (max 5, duplicates ignored).

  Errors: `:too_many_blocked_tags`; `{:invalid_tags, ids}`; `{:tag_conflict, ids}`
  for IDs that are among the profile's positive tags.
  """
  def set_profile_blocked_tags(profile_id, tag_ids),
    do: replace_profile_tags(profile_id, tag_ids, :blocked_tags)

  defp replace_profile_tags(profile_id, tag_ids, assoc) do
    {max_tags, too_many, opposite_assoc} =
      case assoc do
        :tags -> {8, :too_many_tags, :blocked_tags}
        :blocked_tags -> {5, :too_many_blocked_tags, :tags}
      end

    with {:ok, ids} <- normalize_tag_ids(tag_ids),
         :ok <- if(length(ids) <= max_tags, do: :ok, else: {:error, too_many}) do
      Repo.transaction(fn ->
        # Serialises positive/blocked updates so a conflict can never slip in.
        profile =
          from(p in Profile, where: p.id == ^profile_id, lock: "FOR UPDATE")
          |> Repo.one!()
          |> Repo.preload([assoc, opposite_assoc])

        tags = Repo.all(from t in Tag, where: t.id in ^ids and t.is_active == true)
        found_ids = MapSet.new(tags, & &1.id)
        opposite_ids = MapSet.new(Map.fetch!(profile, opposite_assoc), & &1.id)
        invalid = Enum.reject(ids, &MapSet.member?(found_ids, &1))
        conflicting = Enum.filter(ids, &MapSet.member?(opposite_ids, &1))

        cond do
          invalid != [] ->
            Repo.rollback({:invalid_tags, invalid})

          conflicting != [] ->
            Repo.rollback({:tag_conflict, conflicting})

          true ->
            profile
            |> Ecto.Changeset.change()
            |> Ecto.Changeset.put_assoc(assoc, tags)
            |> Repo.update()
            |> case do
              {:ok, updated} -> updated
              {:error, changeset} -> Repo.rollback(changeset)
            end
        end
      end)
    end
  end

  defp normalize_tag_ids(tag_ids) when is_list(tag_ids) do
    {valid, invalid} =
      tag_ids
      |> Enum.map(fn id ->
        case is_binary(id) && Ecto.UUID.cast(id) do
          {:ok, uuid} -> {:ok, uuid}
          _invalid -> {:invalid, id}
        end
      end)
      |> Enum.split_with(&match?({:ok, _uuid}, &1))

    case invalid do
      [] -> {:ok, valid |> Enum.map(&elem(&1, 1)) |> Enum.uniq()}
      _invalid -> {:error, {:invalid_tags, Enum.map(invalid, &elem(&1, 1))}}
    end
  end

  defp normalize_tag_ids(_tag_ids), do: {:error, {:invalid_tags, []}}

  @doc """
  Returns the positive tags for a profile.
  """
  def get_profile_tags(profile_id) do
    profile = Repo.get!(Profile, profile_id) |> Repo.preload(:tags)
    profile.tags
  end

  @doc """
  Returns the blocked tags for a profile.
  """
  def get_profile_blocked_tags(profile_id) do
    profile = Repo.get!(Profile, profile_id) |> Repo.preload(:blocked_tags)
    profile.blocked_tags
  end

  # ── Location ──────────────────────────────────────────────────────────

  @location_min_interval_seconds 60

  @doc """
  Location sent by the mobile client (`POST /api/me/location`). Only
  `latitude`/`longitude` are accepted (always snapped to the 500 m privacy
  grid) plus optional `accuracy_meters`/`recorded_at`; any other key (such as a
  GeoJSON `coordinates`) is ignored.

  Updates less than #{@location_min_interval_seconds} s after the previous one
  are ignored and return the stored location unchanged: repeated fast moves
  would help triangulate someone through the distance labels.
  """
  def update_client_location(profile_id, params) when is_map(params) do
    attrs =
      %{
        "profile_id" => profile_id,
        "latitude" => location_value(params, :latitude, "latitude"),
        "longitude" => location_value(params, :longitude, "longitude"),
        "accuracy_meters" =>
          location_value(params, :accuracy_meters, "accuracy_meters", "accuracyMeters"),
        "recorded_at" => location_value(params, :recorded_at, "recorded_at", "recordedAt")
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    cond do
      not (Map.has_key?(attrs, "latitude") and Map.has_key?(attrs, "longitude")) ->
        {:error, invalid_location_changeset(:coordinates, "latitude and longitude are required")}

      (location = recent_location(profile_id)) != nil ->
        {:ok, location}

      true ->
        upsert_location(attrs)
    end
  end

  defp recent_location(profile_id) do
    case get_location(profile_id) do
      %ProfileLocation{updated_at: %DateTime{} = updated_at} = location ->
        if DateTime.diff(DateTime.utc_now(), updated_at) < @location_min_interval_seconds,
          do: location

      _none ->
        nil
    end
  end

  @doc """
  Inserts or updates a profile's location (internal use: seeds, tests,
  `update_client_location/2`). Accepts `latitude`/`longitude` (snapped to the
  500 m grid) or `coordinates` as a `%Geo.Point{srid: 4326}`; any other
  geometry is rejected.
  """
  def upsert_location(attrs) do
    with {:ok, attrs} <- normalize_location_attrs(attrs) do
      profile_id = attrs["profile_id"]

      case Repo.get(ProfileLocation, profile_id) do
        nil ->
          %ProfileLocation{profile_id: profile_id}
          |> ProfileLocation.changeset(attrs)
          |> Repo.insert()

        loc ->
          loc
          |> ProfileLocation.changeset(attrs)
          |> Repo.update()
      end
    end
  end

  @doc """
  Gets a profile's location.
  """
  def get_location(profile_id) do
    Repo.get(ProfileLocation, profile_id)
  end

  defp normalize_location_attrs(attrs) do
    attrs =
      %{
        "profile_id" => location_value(attrs, :profile_id, "profile_id"),
        "coordinates" => location_value(attrs, :coordinates, "coordinates"),
        "latitude" => location_value(attrs, :latitude, "latitude"),
        "longitude" => location_value(attrs, :longitude, "longitude"),
        "accuracy_meters" =>
          location_value(attrs, :accuracy_meters, "accuracy_meters", "accuracyMeters"),
        "recorded_at" => location_value(attrs, :recorded_at, "recorded_at", "recordedAt")
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    cond do
      Map.has_key?(attrs, "coordinates") ->
        case attrs["coordinates"] do
          %Geo.Point{coordinates: {longitude, latitude}, srid: 4326}
          when is_number(longitude) and is_number(latitude) ->
            case validate_coordinate_bounds(latitude, longitude) do
              :ok -> {:ok, attrs}
              _error -> {:error, invalid_location_changeset(:coordinates, "out of bounds")}
            end

          _other ->
            {:error, invalid_location_changeset(:coordinates, "must be a WGS 84 point")}
        end

      Map.has_key?(attrs, "latitude") and Map.has_key?(attrs, "longitude") ->
        with {:ok, latitude} <- parse_coordinate(attrs["latitude"]),
             {:ok, longitude} <- parse_coordinate(attrs["longitude"]),
             :ok <- validate_coordinate_bounds(latitude, longitude) do
          {:ok, Map.put(attrs, "coordinates", approximate_point(latitude, longitude))}
        else
          _error ->
            {:error,
             invalid_location_changeset(:coordinates, "must be valid latitude and longitude")}
        end

      true ->
        {:ok, attrs}
    end
  end

  defp location_value(attrs, atom_key, string_key) do
    Map.get(attrs, string_key) || Map.get(attrs, atom_key)
  end

  defp location_value(attrs, atom_key, string_key, camel_key) do
    Map.get(attrs, camel_key) || location_value(attrs, atom_key, string_key)
  end

  defp parse_coordinate(value) when is_integer(value), do: {:ok, value / 1}
  defp parse_coordinate(value) when is_float(value), do: {:ok, value}

  defp parse_coordinate(value) when is_binary(value) do
    case Float.parse(value) do
      {coordinate, ""} -> {:ok, coordinate}
      _value -> {:error, :invalid_coordinate}
    end
  end

  defp parse_coordinate(_value), do: {:error, :invalid_coordinate}

  defp validate_coordinate_bounds(latitude, longitude) do
    if latitude >= -90 and latitude <= 90 and longitude >= -180 and longitude <= 180 do
      :ok
    else
      {:error, :invalid_coordinate}
    end
  end

  defp approximate_point(latitude, longitude) do
    grid_meters = 500.0
    latitude_step = grid_meters / 111_320.0

    longitude_step =
      grid_meters / (111_320.0 * max(abs(:math.cos(latitude * :math.pi() / 180)), 0.01))

    approximated_latitude = round_to_grid(latitude, latitude_step)
    approximated_longitude = round_to_grid(longitude, longitude_step)

    %Geo.Point{coordinates: {approximated_longitude, approximated_latitude}, srid: 4326}
  end

  defp round_to_grid(value, step) do
    value
    |> Kernel./(step)
    |> Float.round(0)
    |> Kernel.*(step)
    |> Float.round(6)
  end

  defp invalid_location_changeset(field, message) do
    %ProfileLocation{}
    |> ProfileLocation.changeset(%{})
    |> add_error(field, message)
  end

  @doc "Returns a SQL-ranked discovery page with an opaque cursor."
  defdelegate discovery_feed(viewer_profile_id, opts \\ []), to: Snack.Dating.Discovery, as: :feed

  # ── Swipes & Matching ─────────────────────────────────────────────────

  @doc """
  Records a swipe action.

  On a "like", if the target already liked the actor, creates a `Match`
  and a `Conversation`. Sets `expires_at` to matched_at + `Snack.Dating.MatchExpiry.days/0`
  (30 by default, D-2026-09-29). Swipes of the same pair are serialised (advisory
  lock), so two simultaneous likes always produce exactly one match.

  Returns `{:ok, %{swipe: SwipeAction.t(), match: Match.t() | nil}}`.
  """
  def record_swipe(attrs) do
    actor_id = attrs["actor_profile_id"] || attrs[:actor_profile_id]
    target_id = attrs["target_profile_id"] || attrs[:target_profile_id]
    action_type = attrs["action_type"] || attrs[:action_type]

    Ecto.Multi.new()
    |> Ecto.Multi.run(:pair_lock, fn repo, _changes ->
      lock_swipe_pair(repo, actor_id, target_id)
    end)
    # Revalidated under the pair lock, which `block_profile/1` also takes: a
    # block committed while this swipe waited always wins.
    |> Ecto.Multi.run(:not_blocked, fn repo, _changes ->
      if pair_blocked?(repo, actor_id, target_id),
        do: {:error, :blocked},
        else: {:ok, nil}
    end)
    |> Ecto.Multi.insert(:swipe, fn _changes ->
      %SwipeAction{}
      |> SwipeAction.changeset(attrs)
    end)
    |> Ecto.Multi.run(:match, fn _repo, %{swipe: _swipe} ->
      if action_type == "like" do
        reverse_like =
          Repo.one(
            from s in SwipeAction,
              where:
                s.actor_profile_id == ^target_id and
                  s.target_profile_id == ^actor_id and
                  s.action_type == "like"
          )

        if reverse_like do
          create_match_and_conversation(actor_id, target_id)
        else
          {:ok, nil}
        end
      else
        {:ok, nil}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{swipe: swipe, match: match}} ->
        notify_new_match(match)
        {:ok, %{swipe: swipe, match: match}}

      {:error, :swipe, changeset, _changes} ->
        {:error, changeset}

      {:error, step, reason, _changes} when step in [:pair_lock, :not_blocked, :match] ->
        {:error, reason}
    end
  end

  defp pair_blocked?(repo, a, b) do
    with {:ok, a} <- Ecto.UUID.cast(a),
         {:ok, b} <- Ecto.UUID.cast(b) do
      repo.exists?(
        from(block in UserBlock,
          where:
            (block.actor_profile_id == ^a and block.target_profile_id == ^b) or
              (block.actor_profile_id == ^b and block.target_profile_id == ^a)
        )
      )
    else
      # Invalid ids fail later in the swipe changeset.
      :error -> false
    end
  end

  # Serialises swipes between the same two profiles (either direction) until the
  # transaction ends: of two simultaneous likes, the second waits here and — as
  # READ COMMITTED takes a fresh snapshot per statement — its reverse-like check
  # sees the first one committed, so exactly one of them creates the match.
  # Transaction-scoped advisory lock keyed by the ordered pair; a hash collision
  # between two pairs only costs an unnecessary wait.
  defp lock_swipe_pair(repo, actor_id, target_id)
       when is_binary(actor_id) and is_binary(target_id) do
    [first, second] = Enum.sort([canonical_uuid(actor_id), canonical_uuid(target_id)])

    <<key::signed-integer-size(64), _rest::binary>> =
      :crypto.hash(:sha256, "snack.swipe_pair:" <> first <> ":" <> second)

    case repo.query("SELECT pg_advisory_xact_lock($1)", [key]) do
      {:ok, _result} -> {:ok, key}
      {:error, reason} -> {:error, reason}
    end
  end

  # Invalid ids fail later in the swipe changeset; nothing to serialise.
  defp lock_swipe_pair(_repo, _actor_id, _target_id), do: {:ok, nil}

  defp canonical_uuid(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} -> uuid
      :error -> id
    end
  end

  defp create_match_and_conversation(actor_id, target_id) do
    {a_id, b_id} = if actor_id < target_id, do: {actor_id, target_id}, else: {target_id, actor_id}

    now = DateTime.utc_now() |> DateTime.truncate(:second)
    expires_at = Snack.Dating.MatchExpiry.expires_at(now)

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:match, fn _changes ->
      %Match{}
      |> Match.changeset(%{
        profile_a_id: a_id,
        profile_b_id: b_id,
        status: "active",
        matched_at: now,
        expires_at: expires_at
      })
    end)
    |> Ecto.Multi.insert(:conversation, fn %{match: match} ->
      %Conversation{}
      |> Conversation.changeset(%{match_id: match.id})
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{match: match}} -> {:ok, match}
      {:error, :match, changeset, _} -> {:error, changeset}
      {:error, :conversation, changeset, _} -> {:error, changeset}
    end
  end

  @doc """
  Lists active, non-expired matches for a profile. For the enriched API listing
  (blocks, deleted accounts, last message, unread) see `Snack.Dating.Inbox`.
  """
  def list_matches(profile_id) do
    now = now()

    Match
    |> where(
      [m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now)
    )
    |> order_by([m], desc: m.matched_at)
    |> Repo.all()
  end

  @doc """
  Gets a single match by id.
  """
  def get_match(id) do
    Repo.get(Match, id)
  end

  @doc """
  Unmatches a match by id (sets status to `unmatched`).
  """
  def unmatch(match_id) do
    match = Repo.get!(Match, match_id)

    match
    |> Match.changeset(%{status: "unmatched", unmatched_at: now()})
    |> Repo.update()
  end

  # ── Chat ──────────────────────────────────────────────────────────────

  @doc """
  Lists conversations for a profile via active, non-expired matches. For the
  enriched API listing see `Snack.Dating.Inbox`.
  """
  def list_conversations(profile_id) do
    now = now()

    Conversation
    |> join(:inner, [c], m in Match, on: c.match_id == m.id)
    |> where(
      [c, m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now)
    )
    |> order_by([c], desc: c.inserted_at)
    |> Repo.all()
    |> Repo.preload(:match)
  end

  @doc """
  Gets a single conversation by id.
  """
  def get_conversation(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} -> Repo.get(Conversation, id) |> Repo.preload(:match)
      :error -> nil
    end
  end

  @doc """
  Lists messages for a conversation with pagination.

  `cursor` is an `inserted_at` DateTime; returns messages older than the cursor.
  """
  def list_messages(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    cursor = Keyword.get(opts, :cursor)

    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> then(fn q ->
      if cursor do
        cursor = %{cursor | microsecond: {elem(cursor.microsecond, 0), 6}}
        where(q, [m], m.inserted_at < ^cursor)
      else
        q
      end
    end)
    |> order_by([m], desc: m.inserted_at, desc: m.id)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Sends a message in a conversation.

  On the first message in the conversation, updates the associated match:
  sets `first_message_at` and clears `expires_at`.

  Common send path for REST and WebSocket: after the commit it broadcasts
  `new_message` on `chat:<conversation_id>` (the channel's `handle_out` drops
  it for blocked pairs) and sends the push notification.
  """
  def send_message(attrs) do
    conversation_id = attrs["conversation_id"] || attrs[:conversation_id]
    sender_profile_id = attrs["sender_profile_id"] || attrs[:sender_profile_id]

    Repo.transaction(fn ->
      # Serialize sends with blocking for this pair, then recheck authorization.
      case get_conversation(conversation_id) do
        nil ->
          Repo.rollback(:not_participant)

        conversation ->
          Repo.one!(from m in Match, where: m.id == ^conversation.match_id, lock: "FOR UPDATE")
      end

      with {:ok, conversation} <-
             get_messageable_conversation(conversation_id, sender_profile_id),
           {:ok, message} <- %Message{} |> Message.changeset(attrs) |> Repo.insert() do
        from(m in Match, where: m.id == ^conversation.match_id and is_nil(m.first_message_at))
        |> Repo.update_all(set: [first_message_at: now(), expires_at: nil])

        message
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> case do
      {:ok, message} ->
        broadcast_new_message(message)
        notify_new_message(message)
        {:ok, message}

      error ->
        error
    end
  end

  def get_messageable_conversation(conversation_id, profile_id) do
    conversation =
      case get_conversation(conversation_id) do
        nil -> nil
        conversation -> Repo.preload(conversation, :match)
      end

    cond do
      is_nil(conversation) or is_nil(conversation.match) ->
        {:error, :not_participant}

      !match_participant?(conversation.match, profile_id) ->
        {:error, :not_participant}

      !match_allows_messaging?(conversation.match) ->
        {:error, :conversation_not_active}

      !pair_allows_messaging?(conversation.match) ->
        {:error, :conversation_not_active}

      true ->
        {:ok, conversation}
    end
  end

  defp match_participant?(%Match{} = match, profile_id) do
    match.profile_a_id == profile_id or match.profile_b_id == profile_id
  end

  defp pair_allows_messaging?(%Match{profile_a_id: a, profile_b_id: b}) do
    active_profiles =
      Repo.aggregate(
        from(p in Profile,
          join: u in Snack.Accounts.User,
          on: u.id == p.user_id,
          where: p.id in ^[a, b] and is_nil(p.deleted_at) and is_nil(u.deleted_at)
        ),
        :count,
        :id
      )

    active_profiles == 2 and
      not Repo.exists?(
        from(block in UserBlock,
          where:
            (block.actor_profile_id == ^a and block.target_profile_id == ^b) or
              (block.actor_profile_id == ^b and block.target_profile_id == ^a)
        )
      )
  end

  defp match_allows_messaging?(%Match{status: "active", expires_at: nil}), do: true

  defp match_allows_messaging?(%Match{status: "active", expires_at: %DateTime{} = expires_at}) do
    DateTime.compare(expires_at, now()) == :gt
  end

  defp match_allows_messaging?(_match), do: false

  def conversation_allows_messaging?(conversation_id, profile_id) do
    case get_messageable_conversation(conversation_id, profile_id) do
      {:ok, _conversation} -> true
      {:error, _reason} -> false
    end
  end

  def conversation_messaging_status(conversation_id, profile_id) do
    case get_messageable_conversation(conversation_id, profile_id) do
      {:ok, conversation} -> {:ok, conversation}
      {:error, reason} -> {:error, reason}
    end
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)

  defp notify_new_match(nil), do: :ok

  defp notify_new_match(%Match{} = match) do
    notify(:new_match, Snack.Notifications.deliver_new_match(match))
  end

  defp broadcast_new_message(%Message{} = message) do
    SnackWeb.Endpoint.broadcast(
      "chat:" <> message.conversation_id,
      "new_message",
      SnackWeb.ChatJSON.message(message)
    )
  end

  defp notify_new_message(%Message{} = message) do
    notify(:new_message, Snack.Notifications.deliver_new_message(message))
  end

  defp notify(_event, {:ok, _result}), do: :ok

  defp notify(event, {:error, reason}) do
    Logger.warning("Push notification #{event} failed: #{inspect(reason)}")
    :ok
  end

  # ── Safety ────────────────────────────────────────────────────────────

  @doc """
  Creates a block from one profile to another. Takes the same pair lock as
  `record_swipe/1`, so a like racing with the block either commits first (and
  the block then hides any match) or sees the block and fails.
  """
  def block_profile(attrs \\ %{}) do
    changeset = UserBlock.changeset(%UserBlock{}, attrs)

    if changeset.valid? do
      a = Ecto.Changeset.get_field(changeset, :actor_profile_id)
      b = Ecto.Changeset.get_field(changeset, :target_profile_id)

      Repo.transaction(fn ->
        with {:error, reason} <- lock_swipe_pair(Repo, a, b), do: Repo.rollback(reason)

        from(m in Match,
          where:
            (m.profile_a_id == ^a and m.profile_b_id == ^b) or
              (m.profile_a_id == ^b and m.profile_b_id == ^a),
          lock: "FOR UPDATE"
        )
        |> Repo.all()

        case Repo.insert(changeset) do
          {:ok, block} -> block
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    else
      {:error, changeset}
    end
  end

  @doc """
  Creates a report against a profile.
  """
  def report_profile(attrs \\ %{}) do
    %Report{}
    |> Report.changeset(attrs)
    |> Repo.insert()
  end

  # ── Admin ─────────────────────────────────────────────────────────────

  @doc """
  Lists reports filtered by status, paginated.

  `opts` may include `:limit` and `:offset`.
  """
  def list_reports(status, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    offset = Keyword.get(opts, :offset, 0)

    Report
    |> where([r], r.status == ^status)
    |> order_by([r], desc: r.inserted_at)
    |> limit(^limit)
    |> offset(^offset)
    |> Repo.all()
  end

  @doc """
  Updates a report (e.g., reviewing it).
  """
  def update_report(%Report{} = report, attrs) do
    report
    |> Report.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Disables a profile (admin action).
  Sets `is_discoverable` false and `is_paused` true.
  """
  def disable_profile(%Profile{} = profile) do
    profile
    |> Profile.changeset(%{is_discoverable: false, is_paused: true})
    |> Repo.update()
  end

  # ── Analytics ─────────────────────────────────────────────────────────

  @doc """
  Tracks an analytics event.
  """
  def track_event(attrs \\ %{}) do
    %AnalyticsEvent{}
    |> AnalyticsEvent.changeset(attrs)
    |> Repo.insert()
  end
end
