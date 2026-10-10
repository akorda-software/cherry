defmodule Cherry.Dating.Discovery do
  @moduledoc """
  Discovery feed, ranking v2 (D-2026-09-29).

  Eligibility and score are computed in PostgreSQL in a single statement; the page
  is ordered by `tier ASC, score DESC, id ASC` and paginated with an opaque cursor
  signed for the viewer. Hard filters are re-evaluated on every page.

  ## Eligibility (hard filters)

    * The candidate is complete, discoverable and not paused; neither the profile
      nor the user account is deleted. Never the viewer, never someone the viewer
      already swiped, never someone who already disliked the viewer (a like to
      them would never be seen; undoing that dislike deletes it and lifts the
      exclusion).
    * User blocks in both directions.
    * Blocked tags in both directions: the candidate has none of the viewer's
      blocked tags *and* blocks none of the viewer's positive tags (if A cannot
      see B, B cannot see A).
    * Reciprocal gender and age preferences.
    * Intent compatibility, symmetric (`compatible_intents/1`,
      `intents_compatible?/2`). Each profile has 1–4 intents (`looking_for`).
      Single-intent rule: every intent matches itself and `go_with_the_flow`,
      and `go_with_the_flow` matches every intent; `relationship` and `casual`
      never cross. Two people are compatible when some pair (mine, theirs) is
      compatible under that rule, i.e. `theirs && compatible_intents(mine)`
      (array overlap, GIN-indexable).
    * `compatible_only`, applied symmetrically: when the viewer *or* the candidate
      enables it, at least one shared positive tag is required.
    * Distance: tier 1 is the preferred radius. With `expand_distance` and a
      bounded radius, tier 2 adds the ring up to `min(2 × radius, radius + 100 km)`;
      tier 2 always sorts after every tier-1 candidate. `999999` km means no
      distance limit (single tier).

  ## Score

  SQL works in integer hundredths of a point, so ordering and cursor comparisons
  are exact. Components (points):

  | Component | Points |
  |---|---|
  | Tag affinity | 45 × Σw(shared) / √(Σw(viewer tags) · Σw(candidate tags)), IDF weights (`TagWeights`), active catalog tags only |
  | Intent | +10 when the intent sets share at least one intent; +4 when only compatible through `go_with_the_flow` |
  | Reciprocity | +12 when the candidate already liked the viewer (`liked_viewer`) |
  | Newcomer | +8 at `completed_at`, decreasing linearly to 0 after 7 days (`is_newcomer`) |
  | Activity | +8 if `last_active_at` < 24 h, +5 if < 72 h, +2 if < 7 days |
  | Distance | 10 × (1 − d / R), R = radius of the candidate's tier (500 km scale without limit) |
  | Exploration | 0–4, deterministic per viewer/candidate pair (md5) |
  | Attention fairness | −min(6, pending / 5); pending = likes received in the last 7 days not answered yet |

  Tag affinity is a weighted Ochiai/cosine coefficient: with uniform weights it is
  `shared / √(|viewer tags| · |candidate tags|)`; IDF weights make rare shared tags
  count more. It dominates the score (45 points vs. 10 for distance). Tags the
  catalog deactivated (`tags.is_active = false`) are ignored by the affinity,
  `shared_tags_count` and `compatible_only` (cards hide them too); tag blocks
  still apply to every tag.

  ## Pagination stability

  The cursor stores the tier, score and id of the last row, the reference instant
  (`at`) and the tag-weight generation. Time-based components are computed
  against `at`, pending likes only count likes up to `at` and the weight
  generation is pinned, so neither the passing of time nor a weight refresh
  reorders a feed being paginated. Activity, reciprocity and answered likes can
  only raise a candidate's score mid-session (at worst the candidate is skipped
  until the next fresh feed); a profile or preference edit can move a candidate
  either way, so clients de-duplicate by id.
  """

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.{DiscoveryPreference, Profile, ProfileLocation}
  alias Cherry.Dating.Discovery.PageQuery

  @cursor_salt "discovery-v2"
  @cursor_max_age_seconds 3600

  @flow_intent "go_with_the_flow"

  @units 100
  @exploration_points 4

  # Distance expansion: tier 2 reaches min(factor × radius, radius + extra).
  @expansion_factor 2
  @expansion_max_extra_km 100

  @activity_throttle_seconds 15 * 60

  @doc """
  Returns a ranked page of candidates for `viewer_profile_id`.

  Options: `:limit` (1..100, default 20), `:cursor` (from a previous page) and
  `:now` (reference instant of a first page; defaults to the current time).

  Each row has the keys `id, display_name, birth_date, gender,
  looking_for, bio, is_complete, updated_at, shared_tags_count,
  distance_m, primary_photo_url, photo_count, score, liked_viewer, is_newcomer,
  beyond_preferred_distance`.
  """
  def feed(viewer_profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    with true <- is_integer(limit) and limit in 1..100,
         {:ok, cursor} <- decode_cursor(Keyword.get(opts, :cursor), viewer_profile_id) do
      as_of = if cursor, do: cursor.at, else: reference_time(Keyword.get(opts, :now))
      fetch_page(viewer_profile_id, limit, cursor, as_of, opts)
    else
      false -> {:error, :invalid_limit}
      error -> error
    end
  end

  @doc """
  Intents a profile looking for `intents` (a list, or a single intent) can see
  — and be seen by (the relation is symmetric): the union of each intent's
  compatible set, in canonical order. A candidate is compatible when their
  intents overlap this list.
  """
  def compatible_intents(intents) when is_list(intents) do
    intents
    |> Enum.flat_map(&compatible_intents/1)
    |> Enum.uniq()
    |> Profile.canonical_intents()
  end

  def compatible_intents(@flow_intent), do: Profile.relationship_intents()

  def compatible_intents(intent) when is_binary(intent) do
    if intent in Profile.relationship_intents(), do: [intent, @flow_intent], else: []
  end

  def compatible_intents(_intent), do: []

  @doc """
  Whether two intent lists are compatible (symmetric): some pair (mine, theirs)
  is compatible under the single-intent rule. Mirrors the SQL filter.
  """
  def intents_compatible?(mine, theirs) when is_list(mine) and is_list(theirs) do
    compatible = compatible_intents(mine)
    Enum.any?(theirs, &(&1 in compatible))
  end

  def intents_compatible?(_mine, _theirs), do: false

  @doc "Outer radius (km) of the expanded tier for a bounded `distance_km`."
  def expanded_distance_km(distance_km) do
    min(distance_km * @expansion_factor, distance_km + @expansion_max_extra_km)
  end

  @doc """
  Deterministic exploration bonus for a viewer/candidate pair, in hundredths of a
  point (0..#{@exploration_points * @units}). Mirrors the SQL expression.
  """
  def exploration_units(viewer_id, candidate_id) do
    <<value::unsigned-16, _rest::binary>> = :crypto.hash(:md5, viewer_id <> candidate_id)
    rem(value, @exploration_points * @units + 1)
  end

  @doc """
  Records that `profile` is active now. Writes at most once every 15 minutes per
  profile: skips the database when the loaded value is recent and the UPDATE is
  guarded in SQL against concurrent requests.
  """
  def record_activity(profile, now \\ DateTime.utc_now())

  def record_activity(%Profile{id: id, last_active_at: last_active_at}, now) do
    now = DateTime.truncate(now, :second)

    if last_active_at && DateTime.diff(now, last_active_at) < @activity_throttle_seconds do
      :ok
    else
      threshold = DateTime.add(now, -@activity_throttle_seconds, :second)

      from(p in Profile,
        where: p.id == ^id,
        where: is_nil(p.last_active_at) or p.last_active_at < ^threshold
      )
      |> Repo.update_all(set: [last_active_at: now])

      :ok
    end
  end

  def record_activity(nil, _now), do: :ok

  # ── Page ──────────────────────────────────────────────────────────────

  defp fetch_page(viewer_id, limit, cursor, as_of, opts) do
    case load_viewer(viewer_id, cursor) do
      %{} = viewer ->
        if eligible_viewer?(viewer) do
          run_page(viewer, limit, cursor, as_of, opts)
        else
          {:ok, %{profiles: [], next_cursor: nil}}
        end

      nil ->
        {:ok, %{profiles: [], next_cursor: nil}}
    end
  end

  # First page: latest weight generation. Later pages: the cursor's generation
  # while it exists (it is purged after two hours; then the latest), or no
  # weights at all when the first page had none.
  defp load_viewer(viewer_id, cursor) do
    no_weights? = cursor != nil and cursor.generation == nil
    pinned_generation = cursor && cursor.generation

    Repo.one(
      from(p in Profile,
        join: dp in DiscoveryPreference,
        on: dp.profile_id == p.id,
        join: pl in ProfileLocation,
        on: pl.profile_id == p.id,
        where: p.id == ^viewer_id,
        select: %{
          id: p.id,
          gender: p.gender,
          intents: p.looking_for,
          birth_date: p.birth_date,
          age_min: dp.age_min,
          age_max: dp.age_max,
          distance_km: dp.distance_km,
          expand_distance: dp.expand_distance,
          compatible_only: dp.compatible_only,
          show_men: dp.show_men,
          show_women: dp.show_women,
          show_non_binary: dp.show_non_binary,
          point: pl.coordinates,
          tag_ids: fragment("ARRAY(SELECT tag_id FROM profile_tags WHERE profile_id = ?)", p.id),
          blocked_tag_ids:
            fragment("ARRAY(SELECT tag_id FROM profile_blocked_tags WHERE profile_id = ?)", p.id),
          generation:
            fragment(
              "CASE WHEN ? THEN NULL ELSE COALESCE((SELECT w.generation FROM discovery_tag_weights w WHERE w.generation = ? LIMIT 1), (SELECT max(w.generation) FROM discovery_tag_weights w)) END",
              type(^no_weights?, :boolean),
              type(^pinned_generation, :integer)
            )
        }
      )
    )
  end

  defp eligible_viewer?(viewer) do
    viewer.gender in Profile.genders() and Profile.valid_looking_for?(viewer.intents) and
      match?(%Date{}, viewer.birth_date) and viewer.point != nil
  end

  defp run_page(viewer, limit, cursor, as_of, opts) do
    {sql, params} = PageQuery.build(viewer, limit, cursor, as_of, opts)
    rows = Repo.query!(sql, params).rows |> Enum.map(&row_to_map/1)
    page = Enum.take(rows, limit)

    next_cursor =
      if length(rows) > limit,
        do: encode_cursor(List.last(page), viewer.id, as_of, viewer.generation),
        else: nil

    {:ok, %{profiles: Enum.map(page, &public_row/1), next_cursor: next_cursor}}
  end

  @doc false
  # Diagnostics/benchmark helper: EXPLAIN (ANALYZE, BUFFERS) of the exact
  # statement behind the first page of `feed/2`.
  def explain_feed(viewer_profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    as_of = reference_time(Keyword.get(opts, :now))
    viewer = load_viewer(viewer_profile_id, nil)
    true = viewer != nil and eligible_viewer?(viewer)
    {sql, params} = PageQuery.build(viewer, limit, nil, as_of, opts)

    Repo.query!("EXPLAIN (ANALYZE, BUFFERS) " <> sql, params).rows
    |> Enum.map_join("\n", &hd/1)
  end

  defp row_to_map([
         id,
         display_name,
         birth_date,
         gender,
         looking_for,
         bio,
         is_complete,
         updated_at,
         shared_tags_count,
         distance_m,
         primary_photo_url,
         photo_count,
         score_units,
         liked_viewer,
         is_newcomer,
         tier
       ]) do
    %{
      id: id,
      display_name: display_name,
      birth_date: birth_date,
      gender: gender,
      looking_for: looking_for,
      bio: bio,
      is_complete: is_complete,
      updated_at: updated_at && DateTime.from_naive!(updated_at, "Etc/UTC"),
      shared_tags_count: shared_tags_count,
      distance_m: distance_m,
      primary_photo_url: primary_photo_url,
      photo_count: photo_count,
      score_units: score_units,
      liked_viewer: liked_viewer,
      is_newcomer: is_newcomer,
      tier: tier
    }
  end

  defp public_row(row) do
    row
    |> Map.put(:score, row.score_units / @units)
    |> Map.put(:beyond_preferred_distance, row.tier == 2)
    |> Map.drop([:score_units, :tier])
  end

  defp reference_time(nil), do: DateTime.utc_now() |> DateTime.truncate(:second)
  defp reference_time(%DateTime{} = now), do: DateTime.truncate(now, :second)

  # ── Cursor ────────────────────────────────────────────────────────────

  defp encode_cursor(row, viewer_id, at, generation) do
    Phoenix.Token.sign(CherryWeb.Endpoint, @cursor_salt, %{
      v: viewer_id,
      t: row.tier,
      s: row.score_units,
      id: row.id,
      at: DateTime.to_unix(at),
      g: generation
    })
  end

  defp decode_cursor(nil, _viewer_id), do: {:ok, nil}

  defp decode_cursor(token, viewer_id) when is_binary(token) and byte_size(token) <= 2048 do
    case Phoenix.Token.verify(CherryWeb.Endpoint, @cursor_salt, token,
           max_age: @cursor_max_age_seconds
         ) do
      {:ok, %{v: ^viewer_id, t: tier, s: score, id: id, at: at, g: generation}}
      when tier in [1, 2] and is_integer(score) and is_binary(id) and is_integer(at) and
             (is_integer(generation) or is_nil(generation)) ->
        {:ok,
         %{
           tier: tier,
           score: score,
           id: id,
           at: DateTime.from_unix!(at),
           generation: generation
         }}

      _ ->
        {:error, :invalid_cursor}
    end
  end

  defp decode_cursor(_, _), do: {:error, :invalid_cursor}
end
