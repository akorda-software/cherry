# Synthetic discovery benchmark. Only temporary clones of the current schema,
# inside a local test sandbox; no persistent rows, truncation, or services.
alias Cherry.Repo
alias Ecto.Adapters.SQL.Sandbox

defmodule DiscoverySwipeProbeBench do
  alias Cherry.Repo
  alias Cherry.Dating.Discovery.PageQuery

  defp nodes(node), do: [node | Enum.flat_map(node["Plans"] || [], &nodes/1)]

  def run(viewer, now, name) do
    Enum.reduce(1..2, nil, fn page, cursor ->
      {sql, params} = PageQuery.build(viewer, 20, cursor, now, [])

      # Reconstruct the previous statement, changing only the two redundant
      # operations removed by this batch. Both radius parameters are equal when
      # expansion is disabled, so the old tier predicate can use the geo filter.
      old_tier =
        if viewer.distance_km < 999_999 and not viewer.expand_distance do
          [_, geo_filter] = Regex.run(~r/WHERE (ST_DWithin\(pl.coordinates, [^\n]+\))/, sql)
          String.replace(sql, "1 AS tier", "CASE WHEN #{geo_filter} THEN 1 ELSE 2 END AS tier")
        else
          sql
        end

      baseline =
        String.replace(
          old_tier,
          "s.target_profile_id = p.id OFFSET 0)",
          "s.target_profile_id = p.id)"
        )

      queries =
        if old_tier == sql,
          do: [before: baseline, after: sql],
          else: [before: baseline, probe_only: old_tier, after: sql]

      rows = Repo.query!(sql, params).rows
      true = length(rows) == 21
      for {_version, statement} <- queries, do: true = Repo.query!(statement, params).rows == rows

      samples =
        for _ <- 1..9, {version, statement} <- queries do
          [[[%{} = plan]]] =
            Repo.query!("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " <> statement, params).rows

          {version, plan}
        end

      for {version, plans} <- Enum.group_by(samples, &elem(&1, 0), &elem(&1, 1)) do
        median = plans |> Enum.map(& &1["Execution Time"]) |> Enum.sort() |> Enum.at(4)
        plan = hd(plans)["Plan"]
        all_nodes = nodes(plan)

        probe =
          Enum.find(all_nodes, &(&1["Relation Name"] == "swipe_actions" and &1["Alias"] == "s"))

        candidates = Enum.find(all_nodes, &(&1["Subplan Name"] == "CTE candidates"))

        IO.inspect(
          %{
            median_ms: median,
            candidates: candidates["Actual Rows"],
            local_buffer_hits: plan["Local Hit Blocks"],
            swipe_probe:
              Map.take(probe, [
                "Node Type",
                "Actual Loops",
                "Actual Rows",
                "Rows Removed by Filter",
                "Index Cond",
                "Filter"
              ])
          },
          label: "#{name}-p#{page}/#{version}"
        )

        if directory = System.get_env("BENCH_PLAN_DIR") do
          File.mkdir_p!(directory)

          File.write!(
            Path.join(directory, "#{name}-p#{page}-#{version}.json"),
            Jason.encode!(hd(plans), pretty: true)
          )
        end
      end

      last = Enum.at(rows, 19)
      %{id: Enum.at(last, 0), score: Enum.at(last, 12), tier: Enum.at(last, 15)}
    end)
  end
end

unless Mix.env() == :test and Repo.config()[:pool] == Sandbox and
         Repo.config()[:hostname] in ["localhost", "127.0.0.1", "::1"] do
  raise "local sandbox test database required"
end

:ok = Sandbox.checkout(Repo)
[[database]] = Repo.query!("SELECT current_database()").rows
unless String.contains?(database, "_test"), do: raise("test database required")

try do
  tables =
    ~w(users profiles discovery_preferences profile_locations profile_tags profile_blocked_tags user_blocks swipe_actions profile_photos tags discovery_tag_weights)

  for table <- tables do
    Repo.query!("CREATE TEMP TABLE #{table} (LIKE public.#{table} INCLUDING ALL)")
  end

  n = String.to_integer(System.get_env("BENCH_PROFILES", "5000"))
  unless n in 1000..20000, do: raise("BENCH_PROFILES must be in 1000..20000")
  now = ~U[2026-10-15 07:00:00Z]

  Repo.query!(
    """
    INSERT INTO users (id, email, inserted_at, updated_at)
    SELECT md5('u' || g)::uuid, 'bench' || g || '@example.test', $2, $2
    FROM generate_series(0, $1::int) g
    """,
    [n, DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO profiles
      (id, user_id, display_name, birth_date, gender, looking_for, bio,
       is_complete, is_discoverable, completed_at, last_active_at, inserted_at, updated_at)
    SELECT md5('p' || g)::uuid, md5('u' || g)::uuid, 'Bench ' || g,
           date '1996-01-01', CASE WHEN g = 0 THEN 'woman' ELSE 'man' END,
           CASE WHEN g > 0 AND g % 3 = 0 THEN ARRAY['go_with_the_flow'] ELSE ARRAY['relationship'] END,
           'Synthetic profile, no real data.', true, true,
           $2::timestamp - (g % 12) * interval '1 day',
           $2::timestamp - (g % 9) * interval '1 day', $2, $2
    FROM generate_series(0, $1::int) g
    """,
    [n, DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO discovery_preferences
      (id, profile_id, age_min, age_max, distance_km, show_men, show_women, inserted_at, updated_at)
    SELECT md5('d' || g)::uuid, md5('p' || g)::uuid, 18, 60, 25, true, true, $2, $2
    FROM generate_series(0, $1::int) g
    """,
    [n, DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO profile_locations (profile_id, coordinates, recorded_at, inserted_at, updated_at)
    SELECT md5('p' || g)::uuid,
           ST_SetSRID(ST_MakePoint(-3.7038 + (g % 80) / 85.0, 40.4168), 4326)::geography,
           $2, $2, $2
    FROM generate_series(0, $1::int) g
    """,
    [n, DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO tags (id, slug, label, category, inserted_at, updated_at)
    SELECT md5('t' || g)::uuid, 'bench-' || g, 'Tag ' || g, 'test', $1, $1
    FROM generate_series(0, 63) g
    """,
    [DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO profile_tags (profile_id, tag_id)
    SELECT md5('p' || g)::uuid, md5('t' || ((g + j * 7) % 64))::uuid
    FROM generate_series(0, $1::int) g CROSS JOIN generate_series(0, 7) j
    """,
    [n]
  )

  Repo.query!(
    """
    INSERT INTO swipe_actions (id, actor_profile_id, target_profile_id, action_type, inserted_at)
    SELECT md5('s' || g || '-' || j)::uuid, md5('p' || g)::uuid,
           md5('p' || ((g + j * 17) % $1::int + 1))::uuid,
           CASE WHEN j % 3 = 0 THEN 'dislike' ELSE 'like' END,
           $2::timestamp - (j % 10) * interval '1 day'
    FROM generate_series(1, $1::int) g CROSS JOIN generate_series(1, 40) j
    WHERE g <> ((g + j * 17) % $1::int + 1)
    """,
    [n, DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO profile_photos (id, profile_id, storage_key, url, position, inserted_at, updated_at)
    SELECT md5('ph' || g || '-' || j)::uuid, md5('p' || g)::uuid,
           'bench/' || g || '/' || j, 'https://example.test/' || g || '/' || j, j, $2, $2
    FROM generate_series(0, $1::int) g CROSS JOIN generate_series(1, 3) j
    """,
    [n, DateTime.to_naive(now)]
  )

  for table <- tables, do: Repo.query!("ANALYZE #{table}")

  [[viewer_id, point, tags]] =
    Repo.query!("""
    SELECT p.id::text, pl.coordinates, ARRAY(SELECT tag_id FROM profile_tags t WHERE t.profile_id = p.id)
    FROM profiles p JOIN profile_locations pl ON p.id = pl.profile_id WHERE p.display_name = 'Bench 0'
    """).rows

  viewer = %{
    id: viewer_id,
    point: point,
    tag_ids: tags,
    blocked_tag_ids: [],
    gender: "woman",
    intents: ["relationship"],
    birth_date: ~D[1996-01-01],
    age_min: 18,
    age_max: 60,
    distance_km: 25,
    expand_distance: true,
    compatible_only: false,
    show_men: true,
    show_women: false,
    show_non_binary: false,
    generation: nil
  }

  IO.puts(
    "#{n + 1} synthetic profiles; 40 swipes/profile; 21 identical raw rows; 9 alternating samples after warmup"
  )

  for {name, probe} <- [
        bounded: viewer,
        no_expansion: %{viewer | expand_distance: false},
        unlimited: %{viewer | distance_km: 999_999}
      ] do
    DiscoverySwipeProbeBench.run(probe, now, name)
  end

  # Repeat with an active viewer: existing outgoing swipes and both incoming
  # likes and dislikes, exercising exclusions and reciprocity in the same plan.
  Repo.query!(
    """
    INSERT INTO swipe_actions (id, actor_profile_id, target_profile_id, action_type, inserted_at)
    SELECT md5('viewer-out-' || g)::uuid, md5('p0')::uuid, md5('p' || g)::uuid,
           CASE WHEN g % 2 = 0 THEN 'like' ELSE 'dislike' END, $1
    FROM generate_series(1, 400) g
    """,
    [DateTime.to_naive(now)]
  )

  Repo.query!(
    """
    INSERT INTO swipe_actions (id, actor_profile_id, target_profile_id, action_type, inserted_at)
    SELECT md5('viewer-in-' || g)::uuid, md5('p' || g)::uuid, md5('p0')::uuid,
           CASE WHEN g % 3 = 0 THEN 'dislike' ELSE 'like' END, $1
    FROM generate_series(1, 800) g
    """,
    [DateTime.to_naive(now)]
  )

  Repo.query!("ANALYZE swipe_actions")
  DiscoverySwipeProbeBench.run(viewer, now, :heavy_viewer)
after
  Sandbox.checkin(Repo)
end
