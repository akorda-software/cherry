# Discovery ranking v2 benchmark (D-2026-09-29).
#
# Builds a deterministic synthetic population in a SEPARATE database and measures
# the feed statement with EXPLAIN (ANALYZE, BUFFERS) plus the end-to-end latency
# of `Snack.Dating.Discovery.feed/2` (viewer load + page query + mapping).
#
#   cd apps/backend
#   export DATABASE_URL=ecto://postgres:postgres@localhost:5510/snack_bench
#   mix ecto.create && mix ecto.migrate && mix run priv/repo/seeds.exs
#   BENCH_PROFILES=5000 mix run priv/repo/bench/discovery_bench.exs
#
# Env: BENCH_PROFILES (default 5000), BENCH_RUNS (default 15), BENCH_SKIP_SEED=1
# reuses the data, BENCH_PLAN=1 prints the plan of the heaviest probe and
# BENCH_PLAN=P2 (any probe-name prefix) the plan of that probe.
#
# Output per probe viewer (P1-P5 fixed profiles in Madrid, P6 the discoverable
# profile that received the most swipes): candidates after the hard filters,
# EXPLAIN execution time, end-to-end feed/2 time for page 1 and p50 of page 2.
#
# Reference (2026-09-29, shared dev machine, 5,000 profiles, page of 20):
# EXPLAIN p50 6-22 ms, feed/2 p50 10-23 ms, page 2 = page 1. Cost grows linearly
# with the candidates left after the hard filters (~20-25 µs each).
#
# Safety: refuses to run unless the database name ends in "_bench", because it
# TRUNCATEs users (and everything that cascades from them).

alias Snack.Repo
alias Snack.Dating.Discovery
alias Snack.Dating.Discovery.TagWeights

Logger.configure(level: :warning)

database = Repo.config()[:database] || ""

unless String.ends_with?(database, "_bench") do
  Mix.raise("discovery_bench: refusing to run against #{inspect(database)} (needs *_bench)")
end

# The periodic refresher would race with TRUNCATE; the script refreshes itself.
Supervisor.terminate_child(Snack.Supervisor, TagWeights)

profiles_target = String.to_integer(System.get_env("BENCH_PROFILES", "5000"))
runs = String.to_integer(System.get_env("BENCH_RUNS", "15"))
:rand.seed(:exsss, {20_260_929, 42, 7})

defmodule Bench do
  @madrid {40.4168, -3.7038}
  @cities [
    {:madrid, @madrid, 0.60, 12.0},
    {:madrid_ring, @madrid, 0.15, nil},
    {:barcelona, {41.3874, 2.1686}, 0.10, 10.0},
    {:valencia, {39.4699, -0.3763}, 0.06, 8.0},
    {:sevilla, {37.3891, -5.9845}, 0.05, 8.0},
    {:bilbao, {43.2630, -2.9350}, 0.04, 6.0}
  ]
  @polarizing ~w(smoker cannabis party has_kids childfree wants_kids open_relationship monogamous night_owl gaming vegan sober)

  def madrid, do: @madrid
  def polarizing, do: @polarizing

  def pick_weighted(options) do
    total = Enum.reduce(options, 0.0, fn {_value, weight}, acc -> acc + weight end)
    target = :rand.uniform() * total

    Enum.reduce_while(options, target, fn {value, weight}, left ->
      if left <= weight, do: {:halt, {:picked, value}}, else: {:cont, left - weight}
    end)
    |> case do
      {:picked, value} -> value
      _float_rounding -> options |> List.last() |> elem(0)
    end
  end

  def sample_distinct(options, count, exclude \\ MapSet.new()) do
    Enum.reduce_while(1..(count * 20)//1, {[], exclude}, fn _, {picked, seen} ->
      if length(picked) >= count do
        {:halt, {picked, seen}}
      else
        value = pick_weighted(options)

        if MapSet.member?(seen, value),
          do: {:cont, {picked, seen}},
          else: {:cont, {[value | picked], MapSet.put(seen, value)}}
      end
    end)
    |> elem(0)
  end

  def location do
    region = pick_weighted(Enum.map(@cities, fn {name, _c, w, _s} -> {name, w} end))
    {^region, {lat, lng}, _w, sigma} = List.keyfind(@cities, region, 0)

    {dx, dy} =
      if sigma do
        {:rand.normal() * sigma, :rand.normal() * sigma}
      else
        r = 30 + :rand.uniform() * 120
        theta = :rand.uniform() * 2 * :math.pi()
        {r * :math.cos(theta), r * :math.sin(theta)}
      end

    lat = lat + dy / 111.32
    lng = lng + dx / (111.32 * :math.cos(lat * :math.pi() / 180))
    {region, grid(lat, lng)}
  end

  def point({lat, lng}), do: %Geo.Point{coordinates: {lng, lat}, srid: 4326}

  # Same 500 m privacy grid as Snack.Dating.upsert_location/1.
  defp grid(lat, lng) do
    lat_step = 500.0 / 111_320.0
    lng_step = 500.0 / (111_320.0 * max(abs(:math.cos(lat * :math.pi() / 180)), 0.01))

    {Float.round(Float.round(lat / lat_step, 0) * lat_step, 6),
     Float.round(Float.round(lng / lng_step, 0) * lng_step, 6)}
  end

  def insert_chunks(_table, []), do: :ok

  def insert_chunks(table, rows) do
    columns = rows |> hd() |> map_size()
    chunk = max(div(60_000, columns), 1)
    rows |> Enum.chunk_every(chunk) |> Enum.each(&Snack.Repo.insert_all(table, &1))
  end

  def ago(now, seconds), do: NaiveDateTime.add(now, -round(seconds), :second)

  def percentile(values, p) do
    sorted = Enum.sort(values)
    Enum.at(sorted, min(length(sorted) - 1, round(p * (length(sorted) - 1))))
  end
end

now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
day = 86_400

tags = Repo.query!("SELECT id, slug FROM tags WHERE is_active ORDER BY sort_order").rows

if tags == [] do
  Mix.raise("discovery_bench: seed the tag catalog first (mix run priv/repo/seeds.exs)")
end

# Zipf-like popularity over a fixed shuffle of the catalog.
tag_weights =
  tags
  |> Enum.shuffle()
  |> Enum.with_index(1)
  |> Enum.map(fn {[id, _slug], rank} -> {id, 1 / :math.pow(rank, 0.9)} end)

polarizing =
  for [id, slug] <- tags, slug in Bench.polarizing(), do: {id, 1.0}

probe_specs = [
  %{
    name: "P1 25km+expand relationship",
    gender: "woman",
    age: 30,
    show: [:men],
    distance: 25,
    expand: true,
    intent: "relationship",
    tags: 5,
    blocked: 1,
    swipes: 0,
    compatible_only: false
  },
  %{
    name: "P2 50km+expand go_with_the_flow",
    gender: "man",
    age: 28,
    show: [:women],
    distance: 50,
    expand: true,
    intent: "go_with_the_flow",
    tags: 6,
    blocked: 0,
    swipes: 0,
    compatible_only: false
  },
  %{
    name: "P3 100km(->200) casual",
    gender: "man",
    age: 33,
    show: [:women, :non_binary],
    distance: 100,
    expand: true,
    intent: "casual",
    tags: 4,
    blocked: 2,
    swipes: 0,
    compatible_only: false
  },
  %{
    name: "P4 unlimited everyone gwtf",
    gender: "woman",
    age: 26,
    show: [:men, :women, :non_binary],
    distance: 999_999,
    expand: true,
    intent: "go_with_the_flow",
    tags: 8,
    blocked: 0,
    swipes: 0,
    compatible_only: false
  },
  %{
    name: "P5 25km heavy swiper compat_only",
    gender: "man",
    age: 30,
    show: [:women],
    distance: 25,
    expand: false,
    intent: "relationship",
    tags: 6,
    blocked: 1,
    swipes: 400,
    compatible_only: true
  }
]

if System.get_env("BENCH_SKIP_SEED") != "1" do
  IO.puts("Seeding #{profiles_target} synthetic profiles into #{database}...")

  Repo.query!("TRUNCATE users, discovery_tag_weights CASCADE")

  people =
    for i <- 1..profiles_target do
      probe = Enum.at(probe_specs, i - 1)
      {region, latlng} = if probe, do: {:madrid, Bench.madrid()}, else: Bench.location()

      gender =
        probe[:gender] ||
          Bench.pick_weighted([{"man", 0.46}, {"woman", 0.46}, {"non_binary", 0.08}])

      age = probe[:age] || (:rand.normal() * 7 + 31) |> round() |> max(18) |> min(65)

      show =
        probe[:show] ||
          case gender do
            "man" ->
              Bench.pick_weighted([
                {[:women], 0.8},
                {[:men], 0.1},
                {[:men, :women], 0.05},
                {[:women, :non_binary], 0.05}
              ])

            "woman" ->
              Bench.pick_weighted([
                {[:men], 0.78},
                {[:women], 0.1},
                {[:men, :women], 0.07},
                {[:men, :non_binary], 0.05}
              ])

            _ ->
              Bench.pick_weighted([
                {[:men, :women, :non_binary], 0.5},
                {[:non_binary], 0.2},
                {[:women], 0.15},
                {[:men], 0.15}
              ])
          end

      status =
        if probe,
          do: :active,
          else:
            Bench.pick_weighted([
              {:active, 0.92},
              {:paused, 0.03},
              {:deleted, 0.02},
              {:incomplete, 0.02},
              {:user_deleted, 0.01}
            ])

      tag_count = probe[:tags] || 2 + :rand.uniform(6)
      positive = Bench.sample_distinct(tag_weights, tag_count)

      blocked_count =
        probe[:blocked] || Bench.pick_weighted([{0, 0.4}, {1, 0.3}, {2, 0.2}, {3, 0.1}])

      blocked = Bench.sample_distinct(polarizing, blocked_count, MapSet.new(positive))

      %{
        index: i,
        probe: probe,
        user_id: Ecto.UUID.bingenerate(),
        profile_id: Ecto.UUID.bingenerate(),
        region: region,
        latlng: latlng,
        gender: gender,
        age: age,
        show: show,
        status: status,
        positive: positive,
        blocked: blocked,
        distance:
          probe[:distance] ||
            Bench.pick_weighted([{10, 0.15}, {25, 0.35}, {50, 0.3}, {100, 0.15}, {999_999, 0.05}]),
        expand: if(probe, do: probe.expand, else: :rand.uniform() < 0.8),
        compatible_only: if(probe, do: probe.compatible_only, else: :rand.uniform() < 0.1),
        intent:
          probe[:intent] ||
            Bench.pick_weighted([
              {"relationship", 0.35},
              {"casual", 0.2},
              {"meet_people", 0.15},
              {"go_with_the_flow", 0.3}
            ])
      }
    end

  users =
    Enum.map(people, fn person ->
      %{
        id: person.user_id,
        email: "bench#{person.index}@example.test",
        display_name: "Bench #{person.index}",
        deleted_at: if(person.status == :user_deleted, do: Bench.ago(now, 3 * day)),
        inserted_at: now,
        updated_at: now
      }
    end)

  profiles =
    Enum.map(people, fn person ->
      complete = person.status != :incomplete

      completed_at =
        if complete,
          do:
            Bench.ago(
              now,
              if(:rand.uniform() < 0.05,
                do: :rand.uniform() * 7 * day,
                else: (7 + :rand.uniform() * 173) * day
              )
            )

      last_active_at =
        Bench.ago(
          now,
          Bench.pick_weighted([
            {:rand.uniform() * day, 0.35},
            {(1 + :rand.uniform() * 2) * day, 0.2},
            {(3 + :rand.uniform() * 4) * day, 0.15},
            {(7 + :rand.uniform() * 53) * day, 0.3}
          ])
        )

      birth_date = Date.add(Date.utc_today(), -(person.age * 365 + :rand.uniform(300)))

      %{
        id: person.profile_id,
        user_id: person.user_id,
        display_name: "Bench #{person.index}",
        birth_date: birth_date,
        gender: person.gender,
        what_i_am_looking_for: person.intent,
        bio: "Perfil sintético para el benchmark de discovery.",
        is_complete: complete,
        is_paused: person.status == :paused,
        is_discoverable: person.status == :active,
        deleted_at: if(person.status in [:deleted, :user_deleted], do: Bench.ago(now, 3 * day)),
        completed_at: completed_at,
        last_active_at: last_active_at,
        inserted_at: completed_at || now,
        updated_at: now
      }
    end)

  preferences =
    Enum.map(people, fn person ->
      spread = fn -> 2 + :rand.uniform(8) end

      %{
        id: Ecto.UUID.bingenerate(),
        profile_id: person.profile_id,
        age_min: max(18, person.age - spread.()),
        age_max: min(100, person.age + spread.()),
        distance_km: person.distance,
        show_men: :men in person.show,
        show_women: :women in person.show,
        show_non_binary: :non_binary in person.show,
        compatible_only: person.compatible_only,
        expand_distance: person.expand,
        discovery_mode: "feed",
        inserted_at: now,
        updated_at: now
      }
    end)

  locations =
    Enum.map(people, fn person ->
      %{
        profile_id: person.profile_id,
        coordinates: Bench.point(person.latlng),
        accuracy_meters: 500,
        recorded_at: now,
        inserted_at: now,
        updated_at: now
      }
    end)

  profile_tags =
    for person <- people,
        tag_id <- person.positive,
        do: %{profile_id: person.profile_id, tag_id: tag_id, inserted_at: now}

  blocked_tags =
    for person <- people,
        tag_id <- person.blocked,
        do: %{profile_id: person.profile_id, tag_id: tag_id, inserted_at: now}

  photos =
    for person <- people, position <- 1..(1 + :rand.uniform(3)) do
      %{
        id: Ecto.UUID.bingenerate(),
        profile_id: person.profile_id,
        storage_key: "bench/#{person.index}/#{position}.jpg",
        url: "https://cdn.example.test/bench/#{person.index}/#{position}.jpg",
        position: position,
        is_active: true,
        inserted_at: now,
        updated_at: now
      }
    end

  # Swipes: mostly within the same region, skewed towards "popular" profiles.
  by_region =
    people
    |> Enum.group_by(& &1.region)
    |> Map.new(fn {k, v} -> {k, List.to_tuple(Enum.shuffle(v))} end)

  everyone = people |> Enum.shuffle() |> List.to_tuple()

  pick_target = fn person ->
    pool = if :rand.uniform() < 0.75, do: Map.fetch!(by_region, person.region), else: everyone

    elem(
      pool,
      min(tuple_size(pool) - 1, floor(tuple_size(pool) * :math.pow(:rand.uniform(), 1.7)))
    )
  end

  swipes =
    Enum.flat_map(people, fn person ->
      count = if person.probe, do: person.probe.swipes, else: :rand.uniform(200) - 1
      count = min(count, div(profiles_target, 2))

      Stream.repeatedly(fn -> pick_target.(person) end)
      |> Stream.reject(&(&1.profile_id == person.profile_id))
      |> Stream.uniq_by(& &1.profile_id)
      |> Enum.take(count)
      |> Enum.map(fn target ->
        %{
          id: Ecto.UUID.bingenerate(),
          actor_profile_id: person.profile_id,
          target_profile_id: target.profile_id,
          action_type: if(:rand.uniform() < 0.45, do: "like", else: "dislike"),
          inserted_at: Bench.ago(now, :rand.uniform() * 30 * day)
        }
      end)
    end)

  blocks =
    people
    |> Enum.filter(fn _ -> :rand.uniform() < 0.01 end)
    |> Enum.flat_map(fn person ->
      1..:rand.uniform(2)
      |> Enum.map(fn _ -> pick_target.(person) end)
      |> Enum.reject(&(&1.profile_id == person.profile_id))
      |> Enum.map(&{person.profile_id, &1.profile_id})
    end)
    |> Enum.uniq()
    |> Enum.map(fn {actor, target} ->
      %{
        id: Ecto.UUID.bingenerate(),
        actor_profile_id: actor,
        target_profile_id: target,
        reason: "bench",
        inserted_at: now
      }
    end)

  for {table, rows} <- [
        {"users", users},
        {"profiles", profiles},
        {"discovery_preferences", preferences},
        {"profile_locations", locations},
        {"profile_tags", profile_tags},
        {"profile_blocked_tags", blocked_tags},
        {"profile_photos", photos},
        {"swipe_actions", swipes},
        {"user_blocks", blocks}
      ] do
    Bench.insert_chunks(table, rows)
    IO.puts("  #{String.pad_trailing(table, 22)} #{length(rows)}")
  end

  # Steady state: statistics plus visibility map (index-only scans).
  Repo.query!("VACUUM ANALYZE")
end

{:ok, generation} = TagWeights.refresh()
IO.puts("Tag weight generation #{generation} refreshed.")

probe_ids =
  Repo.query!(
    "SELECT id::text FROM profiles WHERE display_name = ANY($1) ORDER BY display_name",
    [Enum.map(1..length(probe_specs), &"Bench #{&1}")]
  ).rows
  |> Enum.map(&hd/1)

# P6: the discoverable profile that received the most swipes — worst case for
# everything driven by swipes received (reciprocity, dislikes received).
[[popular_id, popular_received]] =
  Repo.query!("""
  SELECT p.id::text, count(*)::int
  FROM swipe_actions s
  JOIN profiles p ON p.id = s.target_profile_id
  JOIN users u ON u.id = p.user_id
  JOIN profile_locations pl ON pl.profile_id = p.id
  JOIN discovery_preferences dp ON dp.profile_id = p.id
  WHERE p.is_discoverable AND p.is_complete AND NOT p.is_paused
    AND p.deleted_at IS NULL AND u.deleted_at IS NULL
  GROUP BY p.id
  ORDER BY count(*) DESC, p.id
  LIMIT 1
  """).rows

probes =
  Enum.zip(probe_specs, probe_ids) ++
    [{%{name: "P6 most-swiped (#{popular_received} recv)"}, popular_id}]

candidate_rows = fn plan ->
  case Regex.run(~r/CTE candidates\n\s+->.*?actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/s, plan) do
    [_, rows] -> String.to_integer(rows)
    _ -> nil
  end
end

execution_ms = fn plan ->
  [_, ms] = Regex.run(~r/Execution Time: ([\d.]+) ms/, plan)
  String.to_float(ms)
end

fmt = fn value -> :erlang.float_to_binary(value / 1, decimals: 1) end

IO.puts(
  "\n" <>
    String.pad_trailing("Probe", 36) <>
    String.pad_leading("cands", 7) <>
    String.pad_leading("EXPLAIN ms min/p50/max", 26) <>
    String.pad_leading("feed/2 ms min/p50/p95", 24) <> String.pad_leading("page2 p50", 11)
)

results =
  for {spec, viewer_id} <- probes do
    plans = for _ <- 1..runs, do: Discovery.explain_feed(viewer_id, limit: 20)
    exec = Enum.map(plans, execution_ms)

    feed_ms =
      for _ <- 1..runs do
        {us, {:ok, _page}} = :timer.tc(fn -> Discovery.feed(viewer_id, limit: 20) end)
        us / 1000
      end

    {:ok, first} = Discovery.feed(viewer_id, limit: 20)

    page2 =
      if first.next_cursor do
        for _ <- 1..runs do
          {us, {:ok, _}} =
            :timer.tc(fn -> Discovery.feed(viewer_id, limit: 20, cursor: first.next_cursor) end)

          us / 1000
        end
        |> Bench.percentile(0.5)
        |> fmt.()
      else
        "-"
      end

    IO.puts(
      String.pad_trailing(spec.name, 36) <>
        String.pad_leading(to_string(candidate_rows.(List.last(plans))), 7) <>
        String.pad_leading(
          "#{fmt.(Enum.min(exec))} / #{fmt.(Bench.percentile(exec, 0.5))} / #{fmt.(Enum.max(exec))}",
          26
        ) <>
        String.pad_leading(
          "#{fmt.(Enum.min(feed_ms))} / #{fmt.(Bench.percentile(feed_ms, 0.5))} / #{fmt.(Bench.percentile(feed_ms, 0.95))}",
          24
        ) <> String.pad_leading(page2, 11)
    )

    %{spec: spec, exec: exec, plan: List.last(plans)}
  end

case System.get_env("BENCH_PLAN") do
  nil ->
    :ok

  "1" ->
    heaviest = Enum.max_by(results, &Bench.percentile(&1.exec, 0.5))
    IO.puts("\nPlan of the heaviest probe (#{heaviest.spec.name}):\n\n#{heaviest.plan}")

  prefix ->
    probe = Enum.find(results, &String.starts_with?(&1.spec.name, prefix))
    IO.puts("\nPlan of #{probe.spec.name}:\n\n#{probe.plan}")
end
