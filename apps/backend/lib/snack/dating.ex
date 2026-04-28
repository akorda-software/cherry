defmodule Snack.Dating do
  @moduledoc """
  The Dating context. Manages profiles, discovery, swipes, matches,
  conversations, safety, and analytics for the dating experience.
  """

  import Ecto.Query

  alias Snack.Repo

  alias Snack.Dating.Profile
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.Tag
  alias Snack.Dating.ProfileLocation
  alias Snack.Dating.SwipeAction
  alias Snack.Dating.Match
  alias Snack.Dating.Conversation
  alias Snack.Dating.Message
  alias Snack.Dating.UserBlock
  alias Snack.Dating.Report
  alias Snack.Dating.AnalyticsEvent

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
  Updates a profile's core fields.
  """
  def update_profile(%Profile{} = profile, attrs) do
    profile
    |> Profile.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Soft-deletes a profile by setting `deleted_at`.
  """
  def delete_profile(%Profile{} = profile) do
    profile
    |> Profile.changeset(%{deleted_at: DateTime.utc_now(), is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking profile changes.
  """
  def change_profile(%Profile{} = profile, attrs \\ %{}) do
    Profile.changeset(profile, attrs)
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
    profile =
      Repo.preload(profile, [:photos, :tags, :discovery_preference, :location])

    active_photos = Enum.count(profile.photos, & &1.is_active)
    photo_ok? = active_photos >= 2 and active_photos <= 4

    bio_ok? =
      is_binary(profile.bio) and
        String.length(String.trim(profile.bio)) >= 20 and
        String.length(String.trim(profile.bio)) <= 240

    prefs_ok? =
      profile.discovery_preference != nil and
        (profile.discovery_preference.show_men or
           profile.discovery_preference.show_women or
           profile.discovery_preference.show_non_binary)

    tags_ok? =
      profile.tags != [] and length(profile.tags) >= 1 and length(profile.tags) <= 8

    location_ok? = profile.location != nil

    photo_ok? and bio_ok? and prefs_ok? and tags_ok? and location_ok?
  end

  @doc """
  Marks `is_complete` true if completeness rules pass.
  """
  def set_profile_complete(%Profile{} = profile) do
    complete = profile_complete?(profile)

    profile
    |> Profile.changeset(%{is_complete: complete})
    |> Repo.update()
  end

  @doc """
  Pauses a profile (sets `is_paused` true and `is_discoverable` false).
  """
  def pause_profile(%Profile{} = profile) do
    profile
    |> Profile.changeset(%{is_paused: true, is_discoverable: false})
    |> Repo.update()
  end

  @doc """
  Unpauses a profile (sets `is_paused` false).
  """
  def unpause_profile(%Profile{} = profile) do
    profile
    |> Profile.changeset(%{is_paused: false})
    |> Repo.update()
  end

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

  @doc """
  Soft-deletes a photo by setting `is_active` false.
  """
  def delete_photo(%ProfilePhoto{} = photo) do
    photo
    |> ProfilePhoto.changeset(%{is_active: false})
    |> Repo.update()
  end

  @doc """
  Reorders photos for a profile by a list of photo IDs.
  """
  def reorder_photos(profile_id, ordered_photo_ids) when is_list(ordered_photo_ids) do
    photos =
      ProfilePhoto
      |> where([p], p.profile_id == ^profile_id and p.is_active == true)
      |> Repo.all()

    photo_map = Map.new(photos, &{&1.id, &1})

    unless Enum.all?(ordered_photo_ids, &Map.has_key?(photo_map, &1)) do
      {:error, :invalid_photo_ids}
    else
      # Phase 1: move all photos to temporary positions to avoid unique
      # constraint conflicts during the reorder.
      multi =
        photos
        |> Enum.with_index(1)
        |> Enum.reduce(Ecto.Multi.new(), fn {photo, i}, multi ->
          Ecto.Multi.update(
            multi,
            {:temp, photo.id},
            Ecto.Changeset.change(photo, position: i + 100)
          )
        end)

      # Phase 2: assign final positions.
      multi =
        ordered_photo_ids
        |> Enum.with_index(1)
        |> Enum.reduce(multi, fn {photo_id, position}, multi ->
          photo = Map.fetch!(photo_map, photo_id)

          Ecto.Multi.update(
            multi,
            {:photo, photo_id},
            ProfilePhoto.changeset(photo, %{position: position})
          )
        end)

      case Repo.transaction(multi) do
        {:ok, _} -> {:ok, list_photos(profile_id)}
        {:error, _, changeset, _} -> {:error, changeset}
      end
    end
  end

  # ── Tags ──────────────────────────────────────────────────────────────

  @doc """
  Lists all active tags ordered by category and sort_order.
  """
  def list_active_tags do
    Tag
    |> where([t], t.is_active == true)
    |> order_by([t], [t.category, t.sort_order, t.label])
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
  Replaces the positive tags on a profile (max 8).
  """
  def set_profile_tags(profile_id, tag_ids) when length(tag_ids) <= 8 do
    profile = Repo.get!(Profile, profile_id)
    tags = Repo.all(from t in Tag, where: t.id in ^tag_ids)

    profile
    |> Repo.preload(:tags)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:tags, tags)
    |> Repo.update()
  end

  def set_profile_tags(_profile_id, _tag_ids) do
    {:error, :too_many_tags}
  end

  @doc """
  Replaces the blocked tags on a profile (max 5).
  """
  def set_profile_blocked_tags(profile_id, tag_ids) when length(tag_ids) <= 5 do
    profile = Repo.get!(Profile, profile_id)
    tags = Repo.all(from t in Tag, where: t.id in ^tag_ids)

    profile
    |> Repo.preload(:blocked_tags)
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:blocked_tags, tags)
    |> Repo.update()
  end

  def set_profile_blocked_tags(_profile_id, _tag_ids) do
    {:error, :too_many_blocked_tags}
  end

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

  @doc """
  Inserts or updates a profile's location.
  """
  def upsert_location(attrs) do
    profile_id = attrs["profile_id"] || attrs[:profile_id]

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

  @doc """
  Gets a profile's location.
  """
  def get_location(profile_id) do
    Repo.get(ProfileLocation, profile_id)
  end

  # ── Discovery Feed ────────────────────────────────────────────────────

  @doc """
  Returns a paginated, scored discovery feed for a viewer.

  Hard filters applied in SQL:
  - discoverable, not deleted, not self
  - not blocked either way
  - not already swiped by viewer
  - within distance radius
  - age within viewer's preferred range AND viewer's age within candidate's preferred range
  - candidate's gender in viewer's interested-in AND viewer's gender in candidate's interested-in
  - intent equality (`what_i_am_looking_for` matches)
  - candidate does not have tags the viewer has blocked

  Scoring (in Elixir):
  - shared tags (+10 per tag, cap 50)
  - reciprocal age preference (+15)
  - reciprocal gender preference (+20)
  - profile quality, i.e. `is_complete` (+15)
  - activity, i.e. updated within last 7 days (+10)
  - distance bonus, linear scale up to +15
  - exploration noise (+0–5)

  Returns profiles with safe fields only (no exact coordinates).
  """
  def discovery_feed(viewer_profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    cursor = Keyword.get(opts, :cursor)

    viewer =
      Repo.get!(Profile, viewer_profile_id)
      |> Repo.preload([:discovery_preference, :location, :tags, :blocked_tags])

    viewer_age = Profile.age(viewer)
    viewer_prefs = viewer.discovery_preference
    viewer_location = viewer.location
    viewer_tag_ids = MapSet.new(viewer.tags, & &1.id)
    viewer_blocked_tag_ids = MapSet.new(viewer.blocked_tags, & &1.id)

    if viewer_prefs == nil or viewer_location == nil or viewer_age == nil do
      {:ok, %{profiles: [], next_cursor: nil}}
    else
      %Geo.Point{coordinates: {lon, lat}} = viewer_location.coordinates
      point = %Geo.Point{coordinates: {lon, lat}, srid: 4326}
      distance_meters = viewer_prefs.distance_km * 1000

      swiped_subquery =
        from s in SwipeAction,
          where: s.actor_profile_id == ^viewer_profile_id,
          select: s.target_profile_id

      blocked_by_viewer_subquery =
        from b in UserBlock,
          where: b.actor_profile_id == ^viewer_profile_id,
          select: b.target_profile_id

      blocked_by_them_subquery =
        from b in UserBlock,
          where: b.target_profile_id == ^viewer_profile_id,
          select: b.actor_profile_id

      candidate_gender_reciprocal =
        case viewer.gender do
          "man" -> dynamic([_p, dp], dp.show_men == true)
          "woman" -> dynamic([_p, dp], dp.show_women == true)
          "non_binary" -> dynamic([_p, dp], dp.show_non_binary == true)
          _ -> dynamic([_p, _dp], false)
        end

      candidates_query =
        from p in Profile,
          join: dp in DiscoveryPreference,
          on: dp.profile_id == p.id,
          join: pl in ProfileLocation,
          on: pl.profile_id == p.id,
          left_join: pt in "profile_tags",
          on: pt.profile_id == p.id,
          where: p.id != ^viewer_profile_id,
          where: p.is_discoverable == true,
          where: is_nil(p.deleted_at),
          where: p.is_paused == false,
          where:
            fragment(
              "ST_DWithin(?::geography, ?::geography, ?)",
              pl.coordinates,
              ^point,
              ^distance_meters
            ),
          where:
            fragment(
              "EXTRACT(YEAR FROM AGE(CURRENT_DATE, ?::date)) BETWEEN ? AND ?",
              p.birth_date,
              ^viewer_prefs.age_min,
              ^viewer_prefs.age_max
            ),
          where:
            fragment(
              "EXTRACT(YEAR FROM AGE(CURRENT_DATE, ?::date)) BETWEEN ? AND ?",
              type(^viewer.birth_date, :date),
              dp.age_min,
              dp.age_max
            ),
          where: p.gender in ^interested_in_genders(viewer_prefs),
          where: ^candidate_gender_reciprocal,
          where: p.what_i_am_looking_for == ^viewer.what_i_am_looking_for,
          where: p.id not in subquery(swiped_subquery),
          where: p.id not in subquery(blocked_by_viewer_subquery),
          where: p.id not in subquery(blocked_by_them_subquery),
          where: is_nil(pt.tag_id) or pt.tag_id not in ^MapSet.to_list(viewer_blocked_tag_ids),
          distinct: p.id,
          select: %{
            id: p.id,
            display_name: p.display_name,
            birth_date: p.birth_date,
            gender: p.gender,
            what_i_am_looking_for: p.what_i_am_looking_for,
            bio: p.bio,
            is_complete: p.is_complete,
            updated_at: p.updated_at,
            tag_ids:
              fragment(
                "ARRAY(SELECT tag_id FROM profile_tags WHERE profile_id = ?)",
                p.id
              ),
            distance_m:
              fragment(
                "ST_Distance(?::geography, ?::geography)",
                pl.coordinates,
                ^point
              )
          }

      candidates_query =
        if cursor do
          where(candidates_query, [p], p.updated_at < ^cursor)
        else
          candidates_query
        end

      candidates =
        candidates_query
        |> Repo.all()

      scored =
        candidates
        |> Enum.map(fn c ->
          c_tag_ids = MapSet.new(c.tag_ids || [])
          shared = MapSet.intersection(viewer_tag_ids, c_tag_ids) |> MapSet.size()

          shared_score = min(shared * 10, 50)
          age_score = 15
          gender_score = 20
          quality_score = if c.is_complete, do: 15, else: 0

          activity_score =
            if DateTime.diff(DateTime.utc_now(), c.updated_at, :day) <= 7, do: 10, else: 0

          distance_km = c.distance_m / 1000.0

          distance_score =
            if viewer_prefs.distance_km > 0 do
              max(0, 15 * (1 - distance_km / viewer_prefs.distance_km))
            else
              0
            end

          noise = :rand.uniform(6) - 1

          score =
            shared_score + age_score + gender_score + quality_score + activity_score +
              distance_score + noise

          Map.merge(c, %{
            score: Float.round(score, 2),
            shared_tags_count: shared
          })
        end)
        |> Enum.sort_by(& &1.score, :desc)
        |> Enum.take(limit + 1)

      {page, next_cursor} =
        case scored do
          [] -> {[], nil}
          list when length(list) > limit ->
            {Enum.take(list, limit), List.last(list).updated_at}

          list ->
            {list, nil}
        end

      # Fallback expansion: if fewer than 30 candidates were found overall,
      # we still return what we have; callers may re-request with relaxed opts.
      # The scoring above already ran on the full candidate pool.
      {:ok, %{profiles: page, next_cursor: next_cursor}}
    end
  end

  defp interested_in_genders(%DiscoveryPreference{} = prefs) do
    genders = []
    genders = if prefs.show_men, do: ["man" | genders], else: genders
    genders = if prefs.show_women, do: ["woman" | genders], else: genders
    genders = if prefs.show_non_binary, do: ["non_binary" | genders], else: genders
    genders
  end

  # ── Swipes & Matching ─────────────────────────────────────────────────

  @doc """
  Records a swipe action.

  On a "like", if the target already liked the actor, creates a `Match`
  and a `Conversation`. Sets `expires_at` to matched_at + 7 days.

  Returns `{:ok, %{swipe: SwipeAction.t(), match: Match.t() | nil}}`.
  """
  def record_swipe(attrs) do
    actor_id = attrs["actor_profile_id"] || attrs[:actor_profile_id]
    target_id = attrs["target_profile_id"] || attrs[:target_profile_id]
    action_type = attrs["action_type"] || attrs[:action_type]

    Ecto.Multi.new()
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
        {:ok, %{swipe: swipe, match: match}}

      {:error, :swipe, changeset, _changes} ->
        {:error, changeset}

      {:error, :match, reason, _changes} ->
        {:error, reason}
    end
  end

  defp create_match_and_conversation(actor_id, target_id) do
    {a_id, b_id} = if actor_id < target_id, do: {actor_id, target_id}, else: {target_id, actor_id}

    now = DateTime.utc_now()
    expires_at = DateTime.add(now, 7, :day)

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
  Lists active matches for a profile.
  """
  def list_matches(profile_id) do
    Match
    |> where(
      [m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active"
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
    |> Match.changeset(%{status: "unmatched", unmatched_at: DateTime.utc_now()})
    |> Repo.update()
  end

  # ── Chat ──────────────────────────────────────────────────────────────

  @doc """
  Lists conversations for a profile via active matches.
  """
  def list_conversations(profile_id) do
    Conversation
    |> join(:inner, [c], m in Match, on: c.match_id == m.id)
    |> where(
      [c, m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active"
    )
    |> order_by([c], desc: c.inserted_at)
    |> Repo.all()
    |> Repo.preload(:match)
  end

  @doc """
  Gets a single conversation by id.
  """
  def get_conversation(id) do
    Repo.get(Conversation, id)
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
        where(q, [m], m.inserted_at < ^cursor)
      else
        q
      end
    end)
    |> order_by([m], desc: m.inserted_at)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Sends a message in a conversation.

  On the first message in the conversation, updates the associated match:
  sets `first_message_at` and clears `expires_at`.
  """
  def send_message(attrs) do
    conversation_id = attrs["conversation_id"] || attrs[:conversation_id]

    is_first_message =
      Message
      |> where([m], m.conversation_id == ^conversation_id)
      |> Repo.aggregate(:count, :id) == 0

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:message, fn _changes ->
      %Message{}
      |> Message.changeset(attrs)
    end)
    |> Ecto.Multi.run(:maybe_update_match, fn _repo, %{message: _message} ->
      if is_first_message do
        conversation = Repo.get!(Conversation, conversation_id)

        Match
        |> where([m], m.id == ^conversation.match_id)
        |> Repo.update_all(
          set: [
            first_message_at: DateTime.utc_now(),
            expires_at: nil
          ]
        )

        {:ok, :updated}
      else
        {:ok, :no_op}
      end
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{message: message}} -> {:ok, message}
      {:error, :message, changeset, _} -> {:error, changeset}
      {:error, :maybe_update_match, reason, _} -> {:error, reason}
    end
  end

  # ── Safety ────────────────────────────────────────────────────────────

  @doc """
  Creates a block from one profile to another.
  """
  def block_profile(attrs \\ %{}) do
    %UserBlock{}
    |> UserBlock.changeset(attrs)
    |> Repo.insert()
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
