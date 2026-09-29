defmodule Snack.Dating.Discovery do
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
    * Intent compatibility, symmetric (`compatible_intents/1`): every intent
      matches itself and `go_with_the_flow`, and `go_with_the_flow` matches every
      intent. `relationship` and `casual` never cross.
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
  | Intent | +10 same intent; +4 compatible through `go_with_the_flow` |
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

  alias Snack.Repo
  alias Snack.Dating.{DiscoveryPreference, Profile, ProfileLocation}
  alias Snack.Dating.Discovery.TagWeights

  @cursor_salt "discovery-v2"
  @cursor_max_age_seconds 3600

  @flow_intent "go_with_the_flow"

  # Score weights, in points. SQL works in hundredths (`@units`).
  @units 100
  @tag_affinity_points 45
  @same_intent_points 10
  @flow_intent_points 4
  @reciprocity_points 12
  @newcomer_points 8
  @newcomer_window_days 7
  @activity_points_24h 8
  @activity_points_72h 5
  @activity_points_7d 2
  @distance_points 10
  @unlimited_distance_scale_km 500
  @exploration_points 4
  @fairness_max_penalty_points 6
  @fairness_likes_per_point 5
  @fairness_window_days 7

  # Distance expansion: tier 2 reaches min(factor × radius, radius + extra).
  @expansion_factor 2
  @expansion_max_extra_km 100

  @activity_throttle_seconds 15 * 60

  @doc """
  Returns a ranked page of candidates for `viewer_profile_id`.

  Options: `:limit` (1..100, default 20), `:cursor` (from a previous page) and
  `:now` (reference instant of a first page; defaults to the current time).

  Each row has the keys `id, display_name, birth_date, gender,
  what_i_am_looking_for, bio, is_complete, updated_at, shared_tags_count,
  distance_m, primary_photo_url, photo_count, score, liked_viewer, is_newcomer,
  beyond_preferred_distance`.
  """
  def feed(viewer_profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)

    with true <- is_integer(limit) and limit in 1..100,
         {:ok, cursor} <- decode_cursor(Keyword.get(opts, :cursor), viewer_profile_id) do
      as_of = if cursor, do: cursor.at, else: reference_time(Keyword.get(opts, :now))
      fetch_page(viewer_profile_id, limit, cursor, as_of)
    else
      false -> {:error, :invalid_limit}
      error -> error
    end
  end

  @doc """
  Intents a profile with `intent` can see — and be seen by (the relation is
  symmetric).
  """
  def compatible_intents(@flow_intent), do: Profile.relationship_intents()

  def compatible_intents(intent) when is_binary(intent) do
    if intent in Profile.relationship_intents(), do: [intent, @flow_intent], else: []
  end

  def compatible_intents(_intent), do: []

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

  defp fetch_page(viewer_id, limit, cursor, as_of) do
    case load_viewer(viewer_id, cursor) do
      %{} = viewer ->
        if eligible_viewer?(viewer) do
          run_page(viewer, limit, cursor, as_of)
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
          intent: p.what_i_am_looking_for,
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
    viewer.gender in Profile.genders() and viewer.intent in Profile.relationship_intents() and
      match?(%Date{}, viewer.birth_date) and viewer.point != nil
  end

  defp run_page(viewer, limit, cursor, as_of) do
    {sql, params} = page_query(viewer, limit, cursor, as_of)
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
    {sql, params} = page_query(viewer, limit, nil, as_of)

    Repo.query!("EXPLAIN (ANALYZE, BUFFERS) " <> sql, params).rows
    |> Enum.map_join("\n", &hd/1)
  end

  defp page_query(viewer, limit, cursor, as_of) do
    limited? = viewer.distance_km < DiscoveryPreference.unlimited_distance_km()
    radius_m = viewer.distance_km * 1000.0

    outer_radius_m =
      if limited? and viewer.expand_distance,
        do: expanded_distance_km(viewer.distance_km) * 1000.0,
        else: radius_m

    as_of_naive = DateTime.to_naive(as_of)

    params =
      [
        viewer: Ecto.UUID.dump!(viewer.id),
        point: viewer.point,
        genders: interested_genders(viewer),
        as_of_date: DateTime.to_date(as_of),
        age_min: viewer.age_min,
        age_max: viewer.age_max,
        viewer_age: age_on(viewer.birth_date, DateTime.to_date(as_of)),
        intents: compatible_intents(viewer.intent),
        intent: viewer.intent,
        tags: viewer.tag_ids,
        blocked_tags: viewer.blocked_tag_ids,
        generation: viewer.generation,
        as_of: as_of_naive,
        newcomer_since: NaiveDateTime.add(as_of_naive, -@newcomer_window_days * 86_400, :second),
        fairness_since: NaiveDateTime.add(as_of_naive, -@fairness_window_days * 86_400, :second),
        limit: limit + 1
      ]
      |> append_if(limited?, radius: radius_m, outer_radius: outer_radius_m)
      |> append_if(cursor != nil, fn ->
        [
          cursor_tier: cursor.tier,
          cursor_score: cursor.score,
          cursor_id: Ecto.UUID.dump!(cursor.id)
        ]
      end)

    positions = params |> Keyword.keys() |> Enum.with_index(1) |> Map.new()
    ph = fn name -> "$#{Map.fetch!(positions, name)}" end

    sql =
      page_sql(ph,
        limited?: limited?,
        cursor?: cursor != nil,
        viewer_compatible_only?: viewer.compatible_only,
        reciprocal_gender: reciprocal_gender_sql(viewer.gender)
      )

    {sql, Keyword.values(params)}
  end

  defp append_if(params, false, _extra), do: params
  defp append_if(params, true, extra) when is_list(extra), do: params ++ extra
  defp append_if(params, true, extra) when is_function(extra, 0), do: params ++ extra.()

  # Hundredths-of-a-point constants interpolated into the SQL below.
  @tag_affinity_units @tag_affinity_points * @units
  @same_intent_units @same_intent_points * @units
  @flow_intent_units @flow_intent_points * @units
  @reciprocity_units @reciprocity_points * @units
  @newcomer_units @newcomer_points * @units
  @newcomer_window_seconds @newcomer_window_days * 86_400
  @distance_units @distance_points * @units
  @exploration_modulo @exploration_points * @units + 1
  @fairness_max_units @fairness_max_penalty_points * @units
  @fairness_units_per_like div(@units, @fairness_likes_per_point)
  @fairness_max_pending @fairness_max_penalty_points * @fairness_likes_per_point

  defp page_sql(ph, opts) do
    default_weight = TagWeights.default_weight()

    # With a bounded radius the GiST index on profile_locations drives the scan.
    {geo_filter, tier_sql, distance_scale} =
      if opts[:limited?] do
        {
          "ST_DWithin(pl.coordinates, #{ph.(:point)}::geography, #{ph.(:outer_radius)}::float8)",
          "CASE WHEN ST_DWithin(pl.coordinates, #{ph.(:point)}::geography, #{ph.(:radius)}::float8) THEN 1 ELSE 2 END",
          "CASE WHEN f.tier = 1 THEN #{ph.(:radius)}::float8 ELSE #{ph.(:outer_radius)}::float8 END"
        }
      else
        {"TRUE", "1", "#{@unlimited_distance_scale_km * 1000}.0"}
      end

    compatible_only_filter =
      if opts[:viewer_compatible_only?],
        do: "ts.shared_count > 0",
        else: "(NOT c.compatible_only OR ts.shared_count > 0)"

    keyset =
      if opts[:cursor?],
        do:
          "(r.tier, -r.score_units, r.id) > (#{ph.(:cursor_tier)}::int, -#{ph.(:cursor_score)}::int, #{ph.(:cursor_id)}::uuid)",
        else: "TRUE"

    """
    -- One row per ACTIVE catalog tag with its weight (default when the pinned
    -- generation has none). Inactive tags never count for affinity nor
    -- shared_tags_count (cards hide them); blocks still use every tag.
    WITH weights AS MATERIALIZED (
      SELECT t.id AS tag_id, COALESCE(w.weight, #{default_weight}) AS weight
      FROM tags t
      LEFT JOIN discovery_tag_weights w
        ON w.tag_id = t.id AND w.generation = #{ph.(:generation)}::bigint
      WHERE t.is_active
    ),
    viewer_tags AS MATERIALIZED (
      SELECT vt.tag_id, w.weight
      FROM unnest(#{ph.(:tags)}::uuid[]) AS vt(tag_id)
      JOIN weights w ON w.tag_id = vt.tag_id
    ),
    candidates AS MATERIALIZED (
      SELECT p.id,
             p.what_i_am_looking_for AS intent,
             p.completed_at,
             p.last_active_at,
             dp.compatible_only,
             ST_Distance(pl.coordinates, #{ph.(:point)}::geography) AS distance_m,
             #{tier_sql} AS tier
      FROM profile_locations pl
      JOIN profiles p ON p.id = pl.profile_id
      JOIN users u ON u.id = p.user_id
      JOIN discovery_preferences dp ON dp.profile_id = p.id
      WHERE #{geo_filter}
        AND p.id <> #{ph.(:viewer)}::uuid
        AND p.is_discoverable AND p.is_complete AND NOT p.is_paused
        AND p.deleted_at IS NULL AND u.deleted_at IS NULL
        AND p.gender = ANY(#{ph.(:genders)}::text[])
        AND #{opts[:reciprocal_gender]}
        -- age BETWEEN age_min AND age_max, as a sargable birth_date range
        -- (identical to date_part('year', age(...)), Feb 29 included)
        AND p.birth_date <= (#{ph.(:as_of_date)}::date - make_interval(years => #{ph.(:age_min)}::int))::date
        AND p.birth_date > (#{ph.(:as_of_date)}::date - make_interval(years => #{ph.(:age_max)}::int + 1))::date
        AND #{ph.(:viewer_age)}::int BETWEEN dp.age_min AND dp.age_max
        AND p.what_i_am_looking_for = ANY(#{ph.(:intents)}::text[])
        AND NOT EXISTS (SELECT 1 FROM swipe_actions s
                        WHERE s.actor_profile_id = #{ph.(:viewer)}::uuid AND s.target_profile_id = p.id)
        -- Already said no to the viewer: a like would never be seen (the likes
        -- inbox only lists unanswered likes). Undo deletes the row, lifting it.
        AND NOT EXISTS (SELECT 1 FROM swipe_actions d
                        WHERE d.target_profile_id = #{ph.(:viewer)}::uuid AND d.actor_profile_id = p.id
                          AND d.action_type = 'dislike')
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                        WHERE b.actor_profile_id = #{ph.(:viewer)}::uuid AND b.target_profile_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM user_blocks b
                        WHERE b.actor_profile_id = p.id AND b.target_profile_id = #{ph.(:viewer)}::uuid)
        AND NOT EXISTS (SELECT 1 FROM profile_tags t
                        WHERE t.profile_id = p.id AND t.tag_id = ANY(#{ph.(:blocked_tags)}::uuid[]))
        AND NOT EXISTS (SELECT 1 FROM profile_blocked_tags bt
                        WHERE bt.profile_id = p.id AND bt.tag_id = ANY(#{ph.(:tags)}::uuid[]))
    ),
    features AS (
      SELECT c.*,
             ts.shared_count AS shared_tags_count,
             ts.shared_weight,
             ts.total_weight,
             c.id IN (SELECT l.actor_profile_id FROM swipe_actions l
                      WHERE l.target_profile_id = #{ph.(:viewer)}::uuid
                        AND l.action_type = 'like') AS liked_viewer,
             (SELECT count(*) FROM (
                SELECT 1 FROM swipe_actions r
                WHERE r.target_profile_id = c.id AND r.action_type = 'like'
                  AND r.inserted_at > #{ph.(:fairness_since)}::timestamp
                  AND r.inserted_at <= #{ph.(:as_of)}::timestamp
                  -- OFFSET 0 keeps this a per-like probe of the unique
                  -- (actor, target) index instead of an anti join that reads
                  -- every swipe the candidate ever made.
                  AND NOT EXISTS (SELECT 1 FROM swipe_actions a
                                  WHERE a.actor_profile_id = c.id
                                    AND a.target_profile_id = r.actor_profile_id
                                  OFFSET 0)
                LIMIT #{@fairness_max_pending}
              ) pending)::int AS pending_likes
      FROM candidates c
      -- Per-candidate probe of profile_tags; a set-level join here is planned
      -- from a (badly) estimated CTE row count and can degrade to a nested loop.
      CROSS JOIN LATERAL (
        SELECT count(vt.tag_id)::int AS shared_count,
               COALESCE(sum(vt.weight), 0) AS shared_weight,
               COALESCE(sum(w.weight), 0) AS total_weight
        FROM profile_tags t
        JOIN weights w ON w.tag_id = t.tag_id
        LEFT JOIN viewer_tags vt ON vt.tag_id = t.tag_id
        WHERE t.profile_id = c.id
      ) ts
      WHERE #{compatible_only_filter}
    ),
    -- MATERIALIZED: the score is computed once per candidate; inlined, the
    -- keyset filter and the sort key would each evaluate it (subplans included).
    ranked AS MATERIALIZED (
      SELECT f.id, f.tier, f.distance_m, f.shared_tags_count, f.liked_viewer,
             (f.completed_at IS NOT NULL
              AND f.completed_at > #{ph.(:newcomer_since)}::timestamp) AS is_newcomer,
             (
               -- tag affinity (IDF-weighted Ochiai)
               LEAST(#{@tag_affinity_units}, ROUND(#{@tag_affinity_units} * CASE
                 WHEN f.shared_weight > 0
                   THEN f.shared_weight / sqrt((SELECT sum(weight) FROM viewer_tags) * f.total_weight)
                 ELSE 0 END))
               -- intent
               + CASE WHEN f.intent = #{ph.(:intent)}::text THEN #{@same_intent_units}
                      ELSE #{@flow_intent_units} END
               -- reciprocity
               + CASE WHEN f.liked_viewer THEN #{@reciprocity_units} ELSE 0 END
               -- newcomer boost, linear decay
               + CASE WHEN f.completed_at IS NULL THEN 0
                      ELSE ROUND(#{@newcomer_units} * GREATEST(0, LEAST(1,
                        1 - EXTRACT(EPOCH FROM (#{ph.(:as_of)}::timestamp - f.completed_at))
                            / #{@newcomer_window_seconds}.0)))
                 END
               -- activity
               + CASE
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '24 hours'
                     THEN #{@activity_points_24h * @units}
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '72 hours'
                     THEN #{@activity_points_72h * @units}
                   WHEN f.last_active_at > #{ph.(:as_of)}::timestamp - interval '7 days'
                     THEN #{@activity_points_7d * @units}
                   ELSE 0
                 END
               -- distance within the tier radius
               + ROUND(#{@distance_units} * GREATEST(0, 1 - f.distance_m / #{distance_scale}))
               -- deterministic exploration per pair
               + ('x' || substr(md5(#{ph.(:viewer)}::uuid::text || f.id::text), 1, 4))::bit(16)::int
                 % #{@exploration_modulo}
               -- attention fairness
               - LEAST(#{@fairness_max_units}, f.pending_likes * #{@fairness_units_per_like})
             )::int AS score_units
      FROM features f
    )
    SELECT r.id::text,
           p.display_name,
           p.birth_date,
           p.gender,
           p.what_i_am_looking_for,
           p.bio,
           p.is_complete,
           p.updated_at,
           r.shared_tags_count,
           r.distance_m,
           (SELECT ph.url FROM profile_photos ph
            WHERE ph.profile_id = r.id AND ph.is_active
            ORDER BY ph.position LIMIT 1) AS primary_photo_url,
           (SELECT count(*) FROM profile_photos ph
            WHERE ph.profile_id = r.id AND ph.is_active)::int AS photo_count,
           r.score_units,
           r.liked_viewer,
           r.is_newcomer,
           r.tier
    FROM (
      SELECT *
      FROM ranked r
      WHERE #{keyset}
      ORDER BY r.tier, r.score_units DESC, r.id
      LIMIT #{ph.(:limit)}::int
    ) r
    JOIN profiles p ON p.id = r.id
    ORDER BY r.tier, r.score_units DESC, r.id
    """
  end

  defp row_to_map([
         id,
         display_name,
         birth_date,
         gender,
         intent,
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
      what_i_am_looking_for: intent,
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

  defp reciprocal_gender_sql("man"), do: "dp.show_men"
  defp reciprocal_gender_sql("woman"), do: "dp.show_women"
  defp reciprocal_gender_sql("non_binary"), do: "dp.show_non_binary"

  defp interested_genders(viewer) do
    [
      {"man", viewer.show_men},
      {"woman", viewer.show_women},
      {"non_binary", viewer.show_non_binary}
    ]
    |> Enum.filter(&elem(&1, 1))
    |> Enum.map(&elem(&1, 0))
  end

  defp age_on(%Date{} = birth_date, %Date{} = on) do
    years = on.year - birth_date.year
    if {on.month, on.day} < {birth_date.month, birth_date.day}, do: years - 1, else: years
  end

  defp reference_time(nil), do: DateTime.utc_now() |> DateTime.truncate(:second)
  defp reference_time(%DateTime{} = now), do: DateTime.truncate(now, :second)

  # ── Cursor ────────────────────────────────────────────────────────────

  defp encode_cursor(row, viewer_id, at, generation) do
    Phoenix.Token.sign(SnackWeb.Endpoint, @cursor_salt, %{
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
    case Phoenix.Token.verify(SnackWeb.Endpoint, @cursor_salt, token,
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
