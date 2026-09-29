defmodule Snack.Dating.DiscoveryTest do
  # Not async: TagWeights.refresh/1 takes a transaction-level advisory lock.
  use Snack.DataCase, async: false

  alias Snack.Accounts.User
  alias Snack.Dating
  alias Snack.Dating.{Discovery, DiscoveryPreference, SwipeAction}
  alias Snack.Dating.Discovery.TagWeights

  @madrid {-3.7038, 40.4168}
  @intents ["relationship", "casual", "meet_people", "go_with_the_flow"]

  # ── Fixtures ──────────────────────────────────────────────────────────

  defp tag(label \\ "Tag") do
    {:ok, tag} =
      Dating.create_tag(%{
        slug: "discovery-#{System.unique_integer([:positive])}",
        label: label,
        category: "test"
      })

    tag
  end

  # A complete, discoverable profile. Defaults isolate every score component:
  # completed 30 days ago (no newcomer boost), no activity, same location.
  defp person(opts \\ []) do
    {:ok, user} =
      Snack.Accounts.create_user(%{
        email: "discovery#{System.unique_integer([:positive])}@example.com",
        display_name: "Discovery"
      })

    age = Keyword.get(opts, :age, 30)

    {:ok, profile} =
      Dating.create_profile(%{
        user_id: user.id,
        display_name: Keyword.get(opts, :name, "Person"),
        birth_date: Date.add(Date.utc_today(), -(age * 365 + 30)),
        gender: Keyword.get(opts, :gender, "man"),
        what_i_am_looking_for: Keyword.get(opts, :intent, "relationship"),
        bio: "Una bio suficientemente larga para pasar la validación."
      })

    show = Keyword.get(opts, :show, [:women])

    {:ok, _pref} =
      Dating.upsert_discovery_preference(profile.id, %{
        age_min: Keyword.get(opts, :age_min, 18),
        age_max: Keyword.get(opts, :age_max, 60),
        distance_km: Keyword.get(opts, :distance_km, 25),
        expand_distance: Keyword.get(opts, :expand_distance, true),
        compatible_only: Keyword.get(opts, :compatible_only, false),
        show_men: :men in show,
        show_women: :women in show,
        show_non_binary: :non_binary in show
      })

    {:ok, _location} =
      Dating.upsert_location(%{
        profile_id: profile.id,
        coordinates: point_east_km(Keyword.get(opts, :km_east, 0)),
        recorded_at: DateTime.utc_now()
      })

    for position <- 1..2 do
      {:ok, _photo} =
        Dating.create_photo(%{
          profile_id: profile.id,
          storage_key: "discovery/#{profile.id}/#{position}",
          url: "https://example.com/#{profile.id}/#{position}.jpg",
          position: position,
          is_active: true
        })
    end

    if tags = Keyword.get(opts, :tags),
      do: {:ok, _} = Dating.set_profile_tags(profile.id, Enum.map(tags, & &1.id))

    if blocked = Keyword.get(opts, :blocked_tags),
      do: {:ok, _} = Dating.set_profile_blocked_tags(profile.id, Enum.map(blocked, & &1.id))

    profile
    |> Ecto.Changeset.change(
      is_complete: Keyword.get(opts, :complete, true),
      is_discoverable: Keyword.get(opts, :discoverable, true),
      is_paused: Keyword.get(opts, :paused, false),
      deleted_at: Keyword.get(opts, :deleted_at),
      completed_at: truncate(Keyword.get(opts, :completed_at, ago(30 * 86_400))),
      last_active_at: truncate(Keyword.get(opts, :last_active_at))
    )
    |> Repo.update!()
  end

  defp viewer(opts \\ []) do
    person(Keyword.merge([gender: "woman", show: [:men], name: "Viewer"], opts))
  end

  defp point_east_km(km) do
    {lng, lat} = @madrid

    %Geo.Point{
      coordinates: {lng + km / (111.32 * :math.cos(lat * :math.pi() / 180)), lat},
      srid: 4326
    }
  end

  defp truncate(nil), do: nil
  defp truncate(%DateTime{} = at), do: DateTime.truncate(at, :second)

  defp ago(seconds),
    do: DateTime.utc_now() |> DateTime.add(-seconds, :second) |> DateTime.truncate(:second)

  defp feed!(viewer, opts \\ []) do
    {:ok, page} = Discovery.feed(viewer.id, Keyword.put_new(opts, :limit, 100))
    page
  end

  defp feed_ids(viewer, opts \\ []),
    do: viewer |> feed!(opts) |> Map.fetch!(:profiles) |> Enum.map(& &1.id)

  defp row(viewer, candidate) do
    viewer |> feed!() |> Map.fetch!(:profiles) |> Enum.find(&(&1.id == candidate.id))
  end

  # Score without the deterministic exploration term, in hundredths.
  defp base_units(viewer, row),
    do: round(row.score * 100) - Discovery.exploration_units(viewer.id, row.id)

  defp like!(actor, target, at \\ DateTime.utc_now()), do: swipe!(actor, target, "like", at)

  defp swipe!(actor, target, action, at \\ DateTime.utc_now()) do
    Repo.insert!(%SwipeAction{
      actor_profile_id: actor.id,
      target_profile_id: target.id,
      action_type: action,
      inserted_at: DateTime.truncate(at, :second)
    })
  end

  # Bare profiles that only exist to send likes.
  defp likers(count) do
    for _ <- 1..count, do: person(gender: "woman", show: [:women], discoverable: false)
  end

  defp collect_pages(viewer, limit, cursor \\ nil, acc \\ []) do
    {:ok, page} = Discovery.feed(viewer.id, limit: limit, cursor: cursor)
    acc = acc ++ page.profiles

    if page.next_cursor, do: collect_pages(viewer, limit, page.next_cursor, acc), else: acc
  end

  # ── Intent ────────────────────────────────────────────────────────────

  describe "intent compatibility" do
    test "follows the owner's matrix" do
      assert Discovery.compatible_intents("relationship") == ["relationship", "go_with_the_flow"]
      assert Discovery.compatible_intents("casual") == ["casual", "go_with_the_flow"]
      assert Discovery.compatible_intents("meet_people") == ["meet_people", "go_with_the_flow"]
      assert Enum.sort(Discovery.compatible_intents("go_with_the_flow")) == Enum.sort(@intents)
      assert Discovery.compatible_intents(nil) == []
      refute "casual" in Discovery.compatible_intents("relationship")
      refute "relationship" in Discovery.compatible_intents("casual")
    end

    test "is symmetric as a relation" do
      for a <- @intents, b <- @intents do
        assert b in Discovery.compatible_intents(a) == a in Discovery.compatible_intents(b),
               "#{a} vs #{b}"
      end
    end

    test "A sees B if and only if B sees A, for every pair of intents" do
      for a <- @intents, b <- @intents do
        # Each pair lives in its own age band so pairs never see each other.
        age =
          20 + length(Enum.take_while(@intents, &(&1 != a))) * 8 +
            length(Enum.take_while(@intents, &(&1 != b))) * 2

        band = [age: age, age_min: age, age_max: age + 1]
        woman = viewer([intent: a] ++ band)
        man = person([intent: b] ++ band)

        expected = b in Discovery.compatible_intents(a)

        assert man.id in feed_ids(woman) == expected, "#{a} -> #{b}"
        assert woman.id in feed_ids(man) == expected, "#{b} -> #{a}"
      end
    end

    test "the same intent scores 6 points more than compatibility through go_with_the_flow" do
      viewer = viewer(intent: "relationship")
      same = person(intent: "relationship")
      flow = person(intent: "go_with_the_flow")

      assert base_units(viewer, row(viewer, same)) - base_units(viewer, row(viewer, flow)) == 600
    end
  end

  # ── Hard filters ──────────────────────────────────────────────────────

  describe "hard filters" do
    test "keep only complete, discoverable, reciprocal and unblocked candidates" do
      viewer = viewer(age: 30, age_min: 25, age_max: 40)
      eligible = person(name: "eligible")

      excluded = [
        person(paused: true, discoverable: false),
        person(discoverable: false),
        person(complete: false),
        person(deleted_at: ago(60)),
        person(gender: "woman", show: [:men]),
        person(show: [:men]),
        person(age: 45),
        person(age_min: 35, age_max: 50),
        person(km_east: 80)
      ]

      account_deleted = person()

      from(u in User, where: u.id == ^account_deleted.user_id)
      |> Repo.update_all(set: [deleted_at: DateTime.utc_now() |> DateTime.truncate(:second)])

      liked = person()
      disliked = person()
      swipe!(viewer, liked, "like")
      swipe!(viewer, disliked, "dislike")

      said_no_to_viewer = person()
      swipe!(said_no_to_viewer, viewer, "dislike")

      blocked_by_viewer = person()
      blocked_viewer = person()

      {:ok, _} =
        Dating.block_profile(%{
          actor_profile_id: viewer.id,
          target_profile_id: blocked_by_viewer.id
        })

      {:ok, _} =
        Dating.block_profile(%{actor_profile_id: blocked_viewer.id, target_profile_id: viewer.id})

      assert feed_ids(viewer) == [eligible.id]
      assert length(excluded) == 9
    end

    test "never includes the viewer and returns nothing without location or preferences" do
      viewer = viewer()
      _candidate = person()
      refute viewer.id in feed_ids(viewer)

      Repo.delete!(Dating.get_location(viewer.id))
      assert %{profiles: [], next_cursor: nil} = feed!(viewer)
    end
  end

  describe "blocked tags" do
    test "exclude a candidate that has a tag the viewer blocks, in both directions" do
      smoker = tag("Fumador/a")
      viewer = viewer(blocked_tags: [smoker])
      candidate = person(tags: [smoker, tag()])
      control = person()

      assert feed_ids(viewer) == [control.id]
      refute viewer.id in feed_ids(candidate)
    end

    test "exclude a candidate that blocks one of the viewer's positive tags, in both directions" do
      party = tag("Salir de fiesta")
      viewer = viewer(tags: [party, tag()])
      candidate = person(blocked_tags: [party])
      control = person()

      assert feed_ids(viewer) == [control.id]
      refute viewer.id in feed_ids(candidate)
    end

    test "blocking a tag nobody has excludes nobody" do
      viewer = viewer(blocked_tags: [tag()])
      candidate = person(tags: [tag()])
      assert feed_ids(viewer) == [candidate.id]
    end
  end

  describe "compatible_only" do
    test "the viewer's flag requires at least one shared positive tag" do
      shared = tag()
      viewer = viewer(compatible_only: true, tags: [shared, tag()])
      sharing = person(tags: [shared])
      _not_sharing = person(tags: [tag()])
      _no_tags = person()

      assert feed_ids(viewer) == [sharing.id]
    end

    test "is applied symmetrically: a candidate with the flag needs a shared tag too" do
      viewer = viewer(tags: [tag()])
      picky = person(compatible_only: true, tags: [tag()])
      relaxed = person(tags: [tag()])

      assert feed_ids(viewer) == [relaxed.id]
      refute viewer.id in feed_ids(picky)
    end
  end

  # ── Score components ──────────────────────────────────────────────────

  describe "tag affinity" do
    test "is a cosine-like overlap worth up to 45 points (uniform weights before any refresh)" do
      [a, b, c, d] = for _ <- 1..4, do: tag()
      viewer = viewer(tags: [a, b, c, d])
      identical = person(tags: [a, b, c, d])
      half = person(tags: [a, b])
      none = person(tags: [tag()])
      untagged = person()

      units = fn candidate -> base_units(viewer, row(viewer, candidate)) end
      # Everything but the tags is equal: 10 intent + 10 distance.
      assert units.(identical) - units.(none) == 4500
      # 2 / sqrt(4 * 2) = 0.7071
      assert units.(half) - units.(none) == round(4500 * 2 / :math.sqrt(8))
      assert units.(untagged) == units.(none)
      assert row(viewer, identical).shared_tags_count == 4
      assert row(viewer, half).shared_tags_count == 2
      assert row(viewer, none).shared_tags_count == 0
    end

    test "IDF weights make a rare shared tag worth more than a popular one" do
      popular = tag("Música")
      rare = tag("Vegano/a")
      filler = tag()
      viewer = viewer(tags: [popular, rare])
      shares_popular = person(tags: [popular, filler])
      shares_rare = person(tags: [rare, filler])

      # Popularity is measured on discoverable profiles only.
      for _ <- 1..6, do: person(gender: "woman", show: [:women], tags: [popular])

      for _ <- 1..4,
          do:
            person(
              gender: "woman",
              show: [:women],
              tags: [popular],
              paused: true,
              discoverable: false
            )

      before = row(viewer, shares_popular).score - row(viewer, shares_rare).score
      assert {:ok, generation} = TagWeights.refresh()

      weights =
        Repo.all(
          from(w in "discovery_tag_weights",
            where: w.generation == ^generation,
            select: {type(w.tag_id, :binary_id), {w.profile_count, w.total_profiles, w.weight}}
          )
        )
        |> Map.new()

      {n_popular, total, w_popular} = Map.fetch!(weights, popular.id)
      {n_rare, ^total, w_rare} = Map.fetch!(weights, rare.id)

      # viewer + 2 candidates + 6 discoverable popular fans (paused ones excluded)
      assert total == 9
      assert n_popular == 8
      assert n_rare == 2
      assert_in_delta w_popular, :math.log(1 + 9 / 9), 1.0e-9
      assert_in_delta w_rare, :math.log(1 + 9 / 3), 1.0e-9

      popular_units = base_units(viewer, row(viewer, shares_popular))
      rare_units = base_units(viewer, row(viewer, shares_rare))
      assert rare_units > popular_units

      # Before the refresh both scored the same except for exploration.
      assert_in_delta before,
                      (Discovery.exploration_units(viewer.id, shares_popular.id) -
                         Discovery.exploration_units(viewer.id, shares_rare.id)) / 100,
                      1.0e-9
    end
  end

  describe "inactive catalog tags" do
    defp deactivate!(tag) do
      Repo.update_all(from(t in "tags", where: t.id == type(^tag.id, :binary_id)),
        set: [is_active: false]
      )
    end

    test "count neither for affinity, shared_tags_count nor compatible_only" do
      [a, b, retired] = for _ <- 1..3, do: tag()
      viewer = viewer(tags: [a, b, retired])
      both = person(tags: [a, b])
      with_retired = person(tags: [a, b, retired])
      only_retired = person(tags: [retired, tag()])
      strict_viewer = viewer(compatible_only: true, tags: [retired])

      assert row(viewer, with_retired).shared_tags_count == 3
      assert only_retired.id in feed_ids(strict_viewer)

      deactivate!(retired)

      units = fn candidate -> base_units(viewer, row(viewer, candidate)) end
      assert row(viewer, with_retired).shared_tags_count == 2
      assert row(viewer, only_retired).shared_tags_count == 0
      # Identical active tags on both sides: full affinity, as if the retired
      # tag did not exist.
      assert units.(with_retired) == units.(both)
      assert units.(both) - units.(only_retired) == 4500
      refute only_retired.id in feed_ids(strict_viewer)
    end

    test "get no IDF weight" do
      active = tag()
      retired = tag()
      _someone = person(gender: "woman", show: [:women], tags: [active, retired])
      deactivate!(retired)

      assert {:ok, generation} = TagWeights.refresh()

      tag_ids =
        Repo.all(
          from(w in "discovery_tag_weights",
            where: w.generation == ^generation,
            select: type(w.tag_id, :binary_id)
          )
        )

      assert active.id in tag_ids
      refute retired.id in tag_ids
    end
  end

  describe "reciprocity" do
    test "a candidate who already liked the viewer gets +12 and is flagged" do
      viewer = viewer()
      admirer = person()
      other = person()
      like!(admirer, viewer)

      admirer_row = row(viewer, admirer)
      other_row = row(viewer, other)

      assert admirer_row.liked_viewer
      refute other_row.liked_viewer
      assert base_units(viewer, admirer_row) - base_units(viewer, other_row) == 1200
      assert hd(feed_ids(viewer)) == admirer.id
    end
  end

  describe "candidates who already disliked the viewer" do
    test "are excluded, so neither side sees the other" do
      viewer = viewer()
      said_no = person()
      admirer = person()
      control = person()

      {:ok, _} =
        Dating.record_swipe(%{
          actor_profile_id: said_no.id,
          target_profile_id: viewer.id,
          action_type: "dislike"
        })

      like!(admirer, viewer)

      ids = feed_ids(viewer)
      refute said_no.id in ids
      assert admirer.id in ids and control.id in ids
      refute viewer.id in feed_ids(said_no)
    end

    test "come back when they undo that dislike" do
      viewer = viewer()
      said_no = person()

      {:ok, _} =
        Dating.record_swipe(%{
          actor_profile_id: said_no.id,
          target_profile_id: viewer.id,
          action_type: "dislike"
        })

      assert feed_ids(viewer) == []

      assert {:ok, undone_target} = Snack.Dating.Social.undo_last_dislike(said_no)
      assert undone_target == viewer.id

      assert feed_ids(viewer) == [said_no.id]
      assert feed_ids(said_no) == [viewer.id]
    end

    test "are excluded from a feed already being paginated" do
      viewer = viewer()
      candidates = for i <- 1..5, do: person(km_east: i)

      {:ok, page} = Discovery.feed(viewer.id, limit: 1)
      assert [%{id: shown_id}] = page.profiles

      # Someone not shown yet says no while the viewer is still paging.
      leaver = Enum.find(candidates, &(&1.id != shown_id))
      swipe!(leaver, viewer, "dislike")

      remaining = viewer |> collect_pages(1, page.next_cursor) |> Enum.map(& &1.id)

      assert length(remaining) == 3
      refute leaver.id in remaining

      assert MapSet.new([shown_id | remaining]) ==
               candidates |> MapSet.new(& &1.id) |> MapSet.delete(leaver.id)
    end
  end

  describe "newcomer boost" do
    test "gives up to 8 points decaying linearly over 7 days" do
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      viewer = viewer()
      fresh = person(completed_at: now)
      half_week = person(completed_at: DateTime.add(now, -84 * 3600, :second))
      week_old = person(completed_at: DateTime.add(now, -8 * 86_400, :second))
      legacy = person(completed_at: nil)

      {:ok, %{profiles: rows}} = Discovery.feed(viewer.id, limit: 10, now: now)
      units = fn candidate -> base_units(viewer, Enum.find(rows, &(&1.id == candidate.id))) end
      flag = fn candidate -> Enum.find(rows, &(&1.id == candidate.id)).is_newcomer end

      assert units.(fresh) - units.(week_old) == 800
      assert units.(half_week) - units.(week_old) == 400
      assert units.(legacy) == units.(week_old)
      assert flag.(fresh) and flag.(half_week)
      refute flag.(week_old) or flag.(legacy)
    end
  end

  describe "activity" do
    test "rewards recent real activity: +8 (<24 h), +5 (<72 h), +2 (<7 d)" do
      viewer = viewer()
      now = DateTime.utc_now() |> DateTime.truncate(:second)
      hour = person(last_active_at: DateTime.add(now, -3600, :second))
      two_days = person(last_active_at: DateTime.add(now, -48 * 3600, :second))
      five_days = person(last_active_at: DateTime.add(now, -5 * 86_400, :second))
      stale = person(last_active_at: DateTime.add(now, -10 * 86_400, :second))
      never = person(last_active_at: nil)

      {:ok, %{profiles: rows}} = Discovery.feed(viewer.id, limit: 10, now: now)
      units = fn candidate -> base_units(viewer, Enum.find(rows, &(&1.id == candidate.id))) end

      assert units.(hour) - units.(never) == 800
      assert units.(two_days) - units.(never) == 500
      assert units.(five_days) - units.(never) == 200
      assert units.(stale) == units.(never)
    end

    test "record_activity writes at most once every 15 minutes" do
      profile = person()
      t0 = DateTime.utc_now() |> DateTime.truncate(:second)

      assert :ok = Discovery.record_activity(profile, t0)
      assert Repo.reload!(profile).last_active_at == t0

      # Within the window: no write, even with a stale struct in hand.
      assert :ok = Discovery.record_activity(profile, DateTime.add(t0, 600, :second))
      assert Repo.reload!(profile).last_active_at == t0

      later = DateTime.add(t0, 16 * 60, :second)
      assert :ok = Discovery.record_activity(Repo.reload!(profile), later)
      assert Repo.reload!(profile).last_active_at == later

      assert :ok = Discovery.record_activity(nil)
    end
  end

  describe "distance" do
    test "is worth 10 points at zero distance, decreasing linearly to the radius" do
      viewer = viewer(distance_km: 25)
      near = person()
      midway = person(km_east: 12.5)

      diff = base_units(viewer, row(viewer, near)) - base_units(viewer, row(viewer, midway))
      assert_in_delta diff, 500, 5
      assert_in_delta row(viewer, midway).distance_m, 12_500, 100
    end
  end

  describe "attention fairness" do
    test "subtracts min(6, pending / 5) for unanswered likes received in the last 7 days" do
      viewer = viewer()
      overloaded = person()
      busy = person()
      calm = person()

      # 30 pending likes -> -6 (cap reached); 10 -> -2
      for liker <- likers(30), do: like!(liker, overloaded)
      for liker <- likers(10), do: like!(liker, busy)

      # Answered, old or dislikes never count.
      answered = likers(5)

      for liker <- answered do
        like!(liker, calm)
        swipe!(calm, liker, "dislike")
      end

      for liker <- likers(5),
          do: like!(liker, calm, DateTime.add(DateTime.utc_now(), -8 * 86_400, :second))

      for liker <- likers(5), do: swipe!(liker, calm, "dislike")

      units = fn candidate -> base_units(viewer, row(viewer, candidate)) end
      assert units.(calm) - units.(overloaded) == 600
      assert units.(calm) - units.(busy) == 200

      # Beyond the cap the penalty stays at 6 points.
      for liker <- likers(10), do: like!(liker, overloaded)
      assert units.(calm) - units.(overloaded) == 600
    end
  end

  # ── Distance tiers ────────────────────────────────────────────────────

  describe "distance expansion" do
    test "expanded radius is min(2 × radius, radius + 100 km)" do
      assert Enum.map([10, 25, 50, 100, 150], &Discovery.expanded_distance_km/1) ==
               [20, 50, 100, 200, 250]
    end

    test "second-tier candidates always come after every first-tier candidate" do
      viewer = viewer(distance_km: 25, expand_distance: true)
      close = person(km_east: 10)
      # Far but with a much better score: liked the viewer and brand new.
      far = person(km_east: 40, completed_at: DateTime.utc_now())
      like!(far, viewer)
      _outside = person(km_east: 60)

      %{profiles: rows} = feed!(viewer)
      assert Enum.map(rows, & &1.id) == [close.id, far.id]
      assert Enum.map(rows, & &1.beyond_preferred_distance) == [false, true]
      assert Enum.at(rows, 1).score > Enum.at(rows, 0).score
    end

    test "is off when expand_distance is false" do
      viewer = viewer(distance_km: 25, expand_distance: false)
      close = person(km_east: 10)
      _far = person(km_east: 40)

      assert feed_ids(viewer) == [close.id]
    end

    test "does not apply to an unlimited distance" do
      viewer = viewer(distance_km: 999_999)
      close = person(km_east: 10)
      far = person(km_east: 600)

      %{profiles: rows} = feed!(viewer)
      assert Enum.sort(Enum.map(rows, & &1.id)) == Enum.sort([close.id, far.id])
      refute Enum.any?(rows, & &1.beyond_preferred_distance)
      # Beyond the 500 km scale distance adds nothing, closer still adds points.
      assert base_units(viewer, row(viewer, close)) > base_units(viewer, row(viewer, far))
    end
  end

  # ── Pagination ────────────────────────────────────────────────────────

  describe "cursor pagination" do
    test "is stable across pages and across tiers" do
      viewer = viewer(distance_km: 25, tags: [tag(), tag()])
      tier_one = for i <- 1..7, do: person(km_east: i * 2)
      tier_two = for i <- 1..5, do: person(km_east: 26 + i * 3)

      %{profiles: all, next_cursor: nil} = feed!(viewer)
      paged = collect_pages(viewer, 2)

      assert Enum.map(paged, & &1.id) == Enum.map(all, & &1.id)
      assert length(paged) == 12
      assert paged |> Enum.map(& &1.id) |> Enum.uniq() |> length() == 12

      assert Enum.take(paged, 7) |> Enum.map(& &1.id) |> MapSet.new() ==
               MapSet.new(tier_one, & &1.id)

      assert Enum.drop(paged, 7) |> Enum.map(& &1.id) |> MapSet.new() ==
               MapSet.new(tier_two, & &1.id)

      for tier <- Enum.chunk_by(paged, & &1.beyond_preferred_distance) do
        scores = Enum.map(tier, & &1.score)
        assert scores == Enum.sort(scores, :desc)
      end
    end

    test "pins the tag-weight generation so a refresh never reorders a feed in progress" do
      common = tag()
      rare = tag()
      viewer = viewer(tags: [common, rare])
      candidates = for i <- 1..6, do: person(tags: if(rem(i, 2) == 0, do: [common], else: [rare]))
      assert length(candidates) == 6

      {:ok, first_generation} = TagWeights.refresh()
      %{profiles: expected} = feed!(viewer)

      {:ok, first} = Discovery.feed(viewer.id, limit: 2)

      # Popularity flips (invisible to the viewer: they only want women).
      for _ <- 1..20, do: person(gender: "woman", show: [:women], tags: [rare])
      {:ok, second_generation} = TagWeights.refresh()
      assert second_generation > first_generation

      rest = collect_pages(viewer, 2, first.next_cursor)
      assert Enum.map(first.profiles ++ rest, & &1.id) == Enum.map(expected, & &1.id)

      # A fresh feed uses the new weights: rare-tag sharers lose value.
      refute Enum.map(feed!(viewer).profiles, & &1.score) == Enum.map(expected, & &1.score)
    end

    test "a feed started before any weight refresh keeps uniform weights until it ends" do
      common = tag()
      rare = tag()
      viewer = viewer(tags: [common, rare])
      for i <- 1..6, do: person(tags: if(rem(i, 2) == 0, do: [common], else: [rare]))
      for _ <- 1..20, do: person(gender: "woman", show: [:women], tags: [rare])

      %{profiles: expected} = feed!(viewer)
      {:ok, first} = Discovery.feed(viewer.id, limit: 2)
      {:ok, _generation} = TagWeights.refresh()

      rest = collect_pages(viewer, 2, first.next_cursor)
      assert Enum.map(first.profiles ++ rest, & &1.id) == Enum.map(expected, & &1.id)
      refute Enum.map(feed!(viewer).profiles, & &1.score) == Enum.map(expected, & &1.score)
    end

    test "rejects foreign, tampered and legacy cursors and invalid limits" do
      viewer = viewer()
      other = viewer()
      for _ <- 1..3, do: person()

      {:ok, %{next_cursor: cursor}} = Discovery.feed(viewer.id, limit: 1)
      assert is_binary(cursor)
      assert {:error, :invalid_cursor} = Discovery.feed(other.id, cursor: cursor)
      assert {:error, :invalid_cursor} = Discovery.feed(viewer.id, cursor: cursor <> "x")
      assert {:error, :invalid_cursor} = Discovery.feed(viewer.id, cursor: 42)

      legacy =
        Phoenix.Token.sign(SnackWeb.Endpoint, "discovery-v1", %{
          viewer: viewer.id,
          score: 1,
          id: viewer.id,
          at: DateTime.utc_now()
        })

      assert {:error, :invalid_cursor} = Discovery.feed(viewer.id, cursor: legacy)

      for limit <- [0, 101, "20", nil],
          do: assert({:error, :invalid_limit} = Discovery.feed(viewer.id, limit: limit))
    end
  end

  describe "rows" do
    test "keep the v1 keys and add the v2 flags" do
      viewer = viewer()
      candidate = person()

      assert %{
               id: id,
               display_name: "Person",
               birth_date: %Date{},
               gender: "man",
               what_i_am_looking_for: "relationship",
               bio: _,
               is_complete: true,
               updated_at: %DateTime{},
               shared_tags_count: 0,
               distance_m: distance,
               primary_photo_url: "https://example.com/" <> _,
               photo_count: 2,
               score: score,
               liked_viewer: false,
               is_newcomer: false,
               beyond_preferred_distance: false
             } = row(viewer, candidate)

      assert id == candidate.id
      assert is_float(distance) and is_float(score)
    end
  end

  # ── Tag weight cache ──────────────────────────────────────────────────

  describe "TagWeights" do
    test "purges generations older than two hours but always keeps the latest" do
      tag()
      t0 = DateTime.utc_now()
      {:ok, old} = TagWeights.refresh(DateTime.add(t0, -3 * 3600, :second))
      {:ok, recent} = TagWeights.refresh(DateTime.add(t0, -3600, :second))
      {:ok, latest} = TagWeights.refresh(t0)

      generations =
        Repo.all(from(w in "discovery_tag_weights", distinct: true, select: w.generation))

      refute old in generations
      assert recent in generations and latest in generations
      assert TagWeights.latest_generation() == latest

      {:ok, stale_but_latest} = TagWeights.refresh(DateTime.add(t0, -5 * 3600, :second))

      assert stale_but_latest in Repo.all(
               from(w in "discovery_tag_weights", select: w.generation)
             )
    end

    test "the refresher does not start under the SQL sandbox unless forced" do
      assert TagWeights.init([]) == :ignore

      assert {:ok, %{interval: 1_000}, {:continue, :refresh}} =
               TagWeights.init(enabled: true, refresh_interval_ms: 1_000)
    end
  end

  # ── Profile lifecycle and preferences ─────────────────────────────────

  describe "completed_at" do
    test "complete_profile/1 stamps the first completion only" do
      profile = person(completed_at: nil, complete: false)
      tag = tag()
      {:ok, _} = Dating.set_profile_tags(profile.id, [tag.id])

      assert {:ok, completed} = Dating.complete_profile(Repo.reload!(profile))
      assert %DateTime{} = first = completed.completed_at

      earlier = DateTime.add(first, -86_400, :second)
      completed |> Ecto.Changeset.change(completed_at: earlier) |> Repo.update!()
      assert {:ok, again} = Dating.complete_profile(Repo.reload!(profile))
      assert again.completed_at == earlier
    end
  end

  defp preference_errors(attrs) do
    base = %{age_min: 20, age_max: 30, distance_km: 25, show_women: true}

    %DiscoveryPreference{}
    |> DiscoveryPreference.changeset(Map.merge(base, attrs))
    |> errors_on()
  end

  describe "DiscoveryPreference validation (#22)" do
    test "accepts only the product distance options" do
      for km <- [10, 25, 50, 100, 999_999],
          do: assert(preference_errors(%{distance_km: km}) == %{})

      for km <- [1, 30, 75, 200, 1_000_000] do
        assert %{distance_km: [message]} = preference_errors(%{distance_km: km})
        assert message =~ "10, 25, 50, 100"
      end
    end

    test "requires age_min <= age_max within 18..100" do
      assert preference_errors(%{age_min: 30, age_max: 30}) == %{}

      assert %{age_max: ["must be greater than or equal to age_min"]} =
               preference_errors(%{age_min: 35, age_max: 30})

      assert %{age_min: [_]} = preference_errors(%{age_min: 17})
      assert %{age_max: [_]} = preference_errors(%{age_max: 101})
    end

    test "expand_distance defaults to true and can be disabled" do
      profile = person()
      pref = Dating.get_discovery_preference(profile.id)
      assert pref.expand_distance

      {:ok, updated} = Dating.upsert_discovery_preference(profile.id, %{expand_distance: false})
      refute updated.expand_distance
    end

    test "a partial update is validated against the stored values" do
      profile = person(age_min: 25, age_max: 35)

      assert {:error, changeset} =
               Dating.upsert_discovery_preference(profile.id, %{"age_min" => 40})

      assert %{age_max: [_]} = errors_on(changeset)
    end
  end
end
