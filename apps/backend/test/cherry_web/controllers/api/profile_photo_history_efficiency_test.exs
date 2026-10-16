defmodule CherryWeb.Controllers.Api.ProfilePhotoHistoryEfficiencyTest do
  use CherryWeb.ConnCase, async: false

  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Dating
  alias Cherry.Dating.ProfilePhoto
  alias Cherry.Repo

  setup do
    user = user_fixture()
    profile = complete_profile_fixture(user)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    history =
      for n <- 1..100 do
        %{
          id: Ecto.UUID.generate(),
          profile_id: profile.id,
          storage_key: "demo/history-#{n}",
          url: "https://example.com/history-#{n}.jpg",
          position: 1,
          is_active: false,
          inserted_at: now,
          updated_at: now
        }
      end

    Repo.insert_all(ProfilePhoto, history)
    %{profile: profile, conn: authed_conn_for_user(user)}
  end

  test "completeness fetches active photos, not the soft-deleted history", %{profile: profile} do
    {missing, queries} = queries(fn -> Dating.profile_completion_missing(profile) end)
    assert missing == []
    assert_active_photo_reads(queries)

    [photo | _] = Dating.list_photos(profile.id)
    photo |> Ecto.Changeset.change(is_active: false) |> Repo.update!()
    assert Dating.profile_completion_missing(profile) == [:photos]
  end

  test "show, update and completion keep photo payloads without reading inactive history", %{
    conn: conn
  } do
    for request <- [
          fn -> get(conn, "/api/me/profile") end,
          fn -> put(conn, "/api/me/profile", %{"display_name" => "History test"}) end,
          fn -> post(conn, "/api/me/profile/complete") end
        ] do
      {response, queries} = queries(request)
      assert %{"profile" => %{"photos" => photos}} = json_response(response, 200)
      assert Enum.map(photos, & &1["position"]) == [1, 2]
      assert Enum.all?(photos, & &1["isActive"])
      assert_active_photo_reads(queries)
    end
  end

  test "already-loaded photo associations retain completeness semantics", %{profile: profile} do
    profile = Repo.preload(profile, [:photos, :tags, :discovery_preference, :location])
    assert Dating.profile_completion_missing(profile) == []
    inactive = Enum.filter(profile.photos, &(not &1.is_active))
    assert Dating.profile_completion_missing(%{profile | photos: inactive}) == [:photos]
  end

  defp assert_active_photo_reads(queries) do
    photo_reads =
      Enum.filter(queries, fn {sql, _result} ->
        String.starts_with?(sql, "SELECT") and String.contains?(sql, ~s(FROM "profile_photos"))
      end)

    assert photo_reads != []
    assert Enum.all?(photo_reads, fn {_sql, {:ok, result}} -> result.num_rows <= 2 end)
  end

  defp queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, {self(), ref})

    try do
      # Ecto runs association preloads in this process inside a transaction.
      {:ok, result} = Repo.transaction(fun)
      {result, collect_queries(ref)}
    after
      :telemetry.detach(handler)
    end
  end

  def query(_event, _measurements, metadata, {owner, ref}) do
    if self() == owner, do: send(owner, {ref, {metadata.query, metadata.result}})
  end

  defp collect_queries(ref) do
    receive do
      {^ref, query} -> [query | collect_queries(ref)]
    after
      0 -> []
    end
  end
end
