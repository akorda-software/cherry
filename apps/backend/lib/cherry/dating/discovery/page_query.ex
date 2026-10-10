defmodule Cherry.Dating.Discovery.PageQuery do
  @moduledoc "Bound SQL parameters, tag affinity and page selection for discovery."

  alias Cherry.Dating.{Discovery, DiscoveryPreference}
  alias Cherry.Dating.Discovery.{Eligibility, Ranking, TagWeights}

  @newcomer_window_days 7
  @unlimited_distance_scale_km 500
  @fairness_window_days 7

  def build(viewer, limit, cursor, as_of, opts) do
    limited? = viewer.distance_km < DiscoveryPreference.unlimited_distance_km()
    radius_m = viewer.distance_km * 1000.0

    outer_radius_m =
      if limited? and viewer.expand_distance,
        do: Discovery.expanded_distance_km(viewer.distance_km) * 1000.0,
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
        intents: Discovery.compatible_intents(viewer.intents),
        viewer_intents: viewer.intents,
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
        reciprocal_gender: reciprocal_gender_sql(viewer.gender),
        prune_fairness?: Keyword.get(opts, :prune_fairness?, true)
      )

    {sql, Keyword.values(params)}
  end

  defp append_if(params, false, _extra), do: params
  defp append_if(params, true, extra) when is_list(extra), do: params ++ extra
  defp append_if(params, true, extra) when is_function(extra, 0), do: params ++ extra.()

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
    #{Eligibility.cte(ph, opts, geo_filter, tier_sql)},
    -- Aggregate tags once across the eligible set. Weights and viewer tags are
    -- hashed once, instead of scanning the catalog for each candidate's tags.
    tag_stats AS (
      SELECT t.profile_id,
             count(vt.tag_id)::int AS shared_count,
             COALESCE(sum(vt.weight), 0) AS shared_weight,
             COALESCE(sum(w.weight), 0) AS total_weight
      FROM candidates c
      JOIN profile_tags t ON t.profile_id = c.id
      JOIN weights w ON w.tag_id = t.tag_id
      LEFT JOIN viewer_tags vt ON vt.tag_id = t.tag_id
      GROUP BY t.profile_id
    ),
    features AS (
      SELECT c.*,
             COALESCE(ts.shared_count, 0) AS shared_tags_count,
             COALESCE(ts.shared_weight, 0) AS shared_weight,
             COALESCE(ts.total_weight, 0) AS total_weight,
             c.id IN (SELECT l.actor_profile_id FROM swipe_actions l
                      WHERE l.target_profile_id = #{ph.(:viewer)}::uuid
                        AND l.action_type = 'like') AS liked_viewer
      FROM candidates c
      LEFT JOIN tag_stats ts ON ts.profile_id = c.id
      WHERE #{compatible_only_filter}
    ),
    -- MATERIALIZED: the score is computed once per candidate; inlined, the
    -- keyset filter and the sort key would each evaluate it (subplans included).
    #{Ranking.ctes(ph, opts, distance_scale)}
    SELECT r.id::text,
           p.display_name,
           p.birth_date,
           p.gender,
           p.looking_for,
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
end
