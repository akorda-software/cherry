defmodule Cherry.DiscoveryQueryEfficiencyTest do
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating
  alias Cherry.Dating.Discovery

  test "bounded feeds use the exact swipe probe and only expanded feeds recompute the tier" do
    viewer = complete_profile_fixture(user_fixture(), %{gender: "woman"})
    _candidate = complete_profile_fixture(user_fixture())

    for {distance, expand, predicate_count} <- [{25, true, 2}, {25, false, 1}, {999_999, true, 0}] do
      {:ok, _} =
        Dating.upsert_discovery_preference(viewer.id, %{
          distance_km: distance,
          expand_distance: expand
        })

      {_page, sql} = checked_page(viewer.id)

      assert String.contains?(sql, "s.target_profile_id = p.id OFFSET 0)") == distance < 999_999
      assert length(Regex.scan(~r/ST_DWithin\(pl.coordinates/, sql)) == predicate_count
    end
  end

  test "old and optimized statements return identical full rows across pages and fresh swipe exclusions" do
    viewer = complete_profile_fixture(user_fixture(), %{gender: "woman"})

    candidates =
      for i <- 1..12 do
        candidate = complete_profile_fixture(user_fixture())

        if rem(i, 2) == 0 do
          {:ok, _} =
            Dating.upsert_location(%{
              profile_id: candidate.id,
              coordinates: %Geo.Point{coordinates: {-3.23, 40.4168}, srid: 4326},
              recorded_at: DateTime.utc_now()
            })
        end

        candidate
      end

    [liked, disliked, rejected, admirer | _] = candidates
    like!(viewer, liked)
    dislike!(viewer, disliked)
    dislike!(rejected, viewer)
    like!(admirer, viewer)

    for {distance, expand} <- [{25, true}, {25, false}, {999_999, true}] do
      {:ok, _} =
        Dating.upsert_discovery_preference(viewer.id, %{
          distance_km: distance,
          expand_distance: expand
        })

      {all, _sql} = checked_page(viewer.id, limit: 100)
      {first, _sql} = checked_page(viewer.id, limit: 2)
      assert first.next_cursor

      # A swipe after page one must remain an immediate hard exclusion; the
      # cursor's score/time snapshot must not cache eligibility.
      newly_swiped = List.last(all.profiles)
      dislike!(viewer, newly_swiped)
      rest = remaining_pages(viewer.id, first.next_cursor)
      actual = first.profiles ++ rest
      expected = Enum.reject(all.profiles, &(&1.id == newly_swiped.id))

      assert actual == expected
      refute Enum.any?(actual, &(&1.id in [liked.id, disliked.id, rejected.id, newly_swiped.id]))
    end
  end

  defp remaining_pages(viewer_id, cursor) do
    {page, _sql} = checked_page(viewer_id, limit: 2, cursor: cursor)

    if page.next_cursor,
      do: page.profiles ++ remaining_pages(viewer_id, page.next_cursor),
      else: page.profiles
  end

  defp checked_page(viewer_id, opts \\ []) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, {self(), ref})

    {page, queries} =
      try do
        {:ok, page} = Discovery.feed(viewer_id, opts)
        {page, collect_queries(ref)}
      after
        :telemetry.detach(handler)
      end

    # Viewer context + one ranking statement, with no extra round trips.
    assert length(queries) == 2

    {sql, params} =
      Enum.find(queries, fn {sql, _params} ->
        String.contains?(sql, "score_ceilings AS MATERIALIZED")
      end)

    baseline =
      String.replace(sql, "s.target_profile_id = p.id OFFSET 0)", "s.target_profile_id = p.id)")

    baseline =
      if String.contains?(sql, "1 AS tier") and String.contains?(sql, "ST_DWithin") do
        [_, geo_filter] = Regex.run(~r/WHERE (ST_DWithin\(pl.coordinates, [^\n]+\))/, sql)
        String.replace(baseline, "1 AS tier", "CASE WHEN #{geo_filter} THEN 1 ELSE 2 END AS tier")
      else
        baseline
      end

    assert Repo.query!(baseline, params).rows == Repo.query!(sql, params).rows
    {page, sql}
  end

  def query(_event, _measurements, metadata, {owner, ref}) do
    if self() == owner, do: send(owner, {ref, metadata.query, metadata.params})
  end

  defp collect_queries(ref) do
    receive do
      {^ref, query, params} -> [{query, params} | collect_queries(ref)]
    after
      0 -> []
    end
  end
end
