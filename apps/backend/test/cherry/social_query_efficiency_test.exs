defmodule Cherry.SocialQueryEfficiencyTest do
  use Cherry.DataCase, async: true

  import Cherry.TestSupport.DatingFixtures
  import Cherry.TestSupport.SocialFixtures

  alias Cherry.Dating
  alias Cherry.Dating.{ProfileCards, Social}

  test "card rows load viewer context and social signals in one statement" do
    viewer = complete_profile_fixture(user_fixture())
    other = complete_profile_fixture(user_fixture())
    like!(other, viewer)

    {rows, queries} = queries(fn -> ProfileCards.rows(viewer.id, [other.id, other.id]) end)

    assert length(queries) == 1
    assert map_size(rows) == 1
    assert rows[other.id].liked_viewer
    refute rows[other.id].viewer_liked
    refute rows[other.id].blocked
    assert_in_delta rows[other.id].distance_m, 0, 0.001
    refute rows[other.id].beyond_preferred_distance
  end

  test "card rows preserve missing-viewer and missing-location fallbacks" do
    other = profile_fixture(user_fixture())
    {rows, queries} = queries(fn -> ProfileCards.rows(Ecto.UUID.generate(), [other.id]) end)

    assert length(queries) == 1
    assert rows[other.id].distance_m == nil
    refute rows[other.id].beyond_preferred_distance
    assert ProfileCards.rows(other.id, []) == %{}
  end

  test "card rows keep the preferred-distance and unlimited-distance signals" do
    viewer = complete_profile_fixture(user_fixture())
    other = complete_profile_fixture(user_fixture())

    {:ok, _} =
      Dating.upsert_location(%{
        profile_id: other.id,
        coordinates: %Geo.Point{coordinates: {2.1686, 41.3874}, srid: 4326},
        recorded_at: DateTime.utc_now()
      })

    row = ProfileCards.rows(viewer.id, [other.id])[other.id]
    assert row.distance_m > 500_000
    assert row.beyond_preferred_distance

    Dating.upsert_discovery_preference(viewer.id, %{distance_km: 999_999})
    refute ProfileCards.rows(viewer.id, [other.id])[other.id].beyond_preferred_distance
  end

  test "received likes and their count apply viewer preferences without a separate lookup" do
    viewer = complete_profile_fixture(user_fixture())
    man = complete_profile_fixture(user_fixture())
    woman = complete_profile_fixture(user_fixture(), %{gender: "woman"})
    like!(man, viewer)
    like!(woman, viewer)
    Dating.upsert_discovery_preference(viewer.id, %{show_men: false})

    {{:ok, page}, page_queries} = queries(fn -> Social.received_likes(viewer) end)
    {count, count_queries} = queries(fn -> Social.received_likes_count(viewer) end)

    assert Enum.map(page.likes, & &1.profile_id) == [woman.id]
    assert count == 1
    assert length(page_queries) == 1
    assert length(count_queries) == 1
  end

  test "social filters reread preferences even when the viewer carries a stale preload" do
    viewer = complete_profile_fixture(user_fixture()) |> Repo.preload(:discovery_preference)
    other = complete_profile_fixture(user_fixture())
    like!(other, viewer)
    Dating.upsert_discovery_preference(viewer.id, %{show_men: false})

    assert {:ok, %{likes: []}} = Social.received_likes(viewer)
    assert Social.received_likes_count(viewer) == 0
  end

  test "a viewer without preferences keeps the legacy unrestricted preference fallback" do
    viewer = profile_fixture(user_fixture())
    other = complete_profile_fixture(user_fixture())
    like!(other, viewer)

    {{:ok, page}, queries} = queries(fn -> Social.received_likes(viewer) end)
    assert [%{profile_id: id}] = page.likes
    assert id == other.id
    assert length(queries) == 1
  end

  defp queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, {self(), ref})

    try do
      result = fun.()
      {result, collect_queries(ref)}
    after
      :telemetry.detach(handler)
    end
  end

  def query(_event, _measurements, metadata, {owner, ref}) do
    if self() == owner, do: send(owner, {ref, metadata.query})
  end

  defp collect_queries(ref) do
    receive do
      {^ref, query} -> [query | collect_queries(ref)]
    after
      0 -> []
    end
  end
end
