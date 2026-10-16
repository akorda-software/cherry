defmodule Cherry.PhotoStorageBatchTest do
  use Cherry.DataCase, async: false

  import Cherry.TestSupport.DatingFixtures

  alias Cherry.Dating.{PhotoStorage, PhotoStorageSweeper, ProfilePhoto, ProfilePhotoUploadIntent}

  defmodule StorageStub do
    def delete_object(key) do
      send(self(), {:storage_delete, key})
      if key in Process.get(:failed_storage_keys, []), do: {:error, :unavailable}, else: :ok
    end
  end

  setup do
    previous = Application.get_env(:cherry, Cherry.Storage)
    Application.put_env(:cherry, Cherry.Storage, adapter: StorageStub)
    on_exit(fn -> Application.put_env(:cherry, Cherry.Storage, previous) end)

    %{
      profile: profile_fixture(user_fixture()),
      now: DateTime.utc_now() |> DateTime.truncate(:second)
    }
  end

  test "each sweep bounds both kinds and marks successful photos in one write", ctx do
    for n <- 1..5 do
      photo!(ctx.profile, n)
      intent!(ctx.profile, n, DateTime.add(ctx.now, -600, :second))
    end

    {result, queries} = queries(fn -> PhotoStorage.sweep(ctx.now, 3) end)
    assert result == %{photos: 3, intents: 3}
    assert length(queries) == 4

    selects = Enum.filter(queries, fn {sql, _} -> String.starts_with?(sql, "SELECT") end)
    assert length(selects) == 2
    assert Enum.all?(selects, fn {_sql, {:ok, result}} -> result.num_rows == 3 end)
    assert %{photos: 2, intents: 2} = PhotoStorage.sweep(ctx.now, 3)

    assert {%{photos: 0, intents: 0}, queries} = queries(fn -> PhotoStorage.sweep(ctx.now, 3) end)
    assert length(queries) == 2
  end

  test "storage failures remain unmarked and retry without touching active or recent objects",
       ctx do
    failed = photo!(ctx.profile, 1)
    successful = photo!(ctx.profile, 2)
    active = photo!(ctx.profile, 3, true)
    expired = intent!(ctx.profile, 1, DateTime.add(ctx.now, -600, :second))
    recent = intent!(ctx.profile, 2, DateTime.add(ctx.now, -299, :second))
    Process.put(:failed_storage_keys, [failed.storage_key, expired.storage_key])

    assert %{photos: 1, intents: 0} = PhotoStorage.sweep(ctx.now, 5)
    refute Repo.get!(ProfilePhoto, failed.id).storage_deleted_at
    assert Repo.get!(ProfilePhoto, successful.id).storage_deleted_at
    refute Repo.get!(ProfilePhoto, active.id).storage_deleted_at
    refute Repo.get!(ProfilePhotoUploadIntent, expired.id).storage_deleted_at
    refute Repo.get!(ProfilePhotoUploadIntent, recent.id).storage_deleted_at
    active_key = active.storage_key
    recent_key = recent.storage_key
    refute_received {:storage_delete, ^active_key}
    refute_received {:storage_delete, ^recent_key}

    Process.put(:failed_storage_keys, [])
    assert %{photos: 1, intents: 1} = PhotoStorage.sweep(ctx.now, 5)
  end

  test "completed intents only delete their pending object", ctx do
    intent = intent!(ctx.profile, 1, DateTime.add(ctx.now, -600, :second))
    intent |> Ecto.Changeset.change(completed_at: ctx.now) |> Repo.update!()
    assert %{photos: 0, intents: 1} = PhotoStorage.sweep(ctx.now, 5)
    assert_received {:storage_delete, "pending/" <> _}
    final_key = intent.storage_key
    refute_received {:storage_delete, ^final_key}
  end

  test "invalid batch sizes fail before querying or deleting storage", ctx do
    for batch <- [nil, 0, -1, 1001, 1.5, "3"] do
      {_result, queries} =
        queries(fn ->
          assert_raise ArgumentError, ~r/batch size/, fn -> PhotoStorage.sweep(ctx.now, batch) end
        end)

      assert queries == []
    end

    refute_received {:storage_delete, _}
  end

  test "sweeper validates its timers and batch size and forwards the configured limit", ctx do
    for opts <- [
          [batch_size: nil],
          [batch_size: 0],
          [batch_size: 1001],
          [interval_ms: 0],
          [interval_ms: "100"],
          [initial_delay_ms: -1]
        ] do
      assert_raise ArgumentError, fn -> PhotoStorageSweeper.init([enabled: true] ++ opts) end
    end

    photo!(ctx.profile, 1)
    photo!(ctx.profile, 2)

    assert {:ok, state} =
             PhotoStorageSweeper.init(
               enabled: true,
               batch_size: 1,
               initial_delay_ms: 60_000,
               interval_ms: 60_000
             )

    assert {:noreply, ^state} = PhotoStorageSweeper.handle_info(:sweep, state)

    assert Repo.aggregate(
             from(p in ProfilePhoto, where: not is_nil(p.storage_deleted_at)),
             :count
           ) == 1
  end

  defp photo!(profile, n, active \\ false) do
    %ProfilePhoto{}
    |> ProfilePhoto.changeset(%{
      profile_id: profile.id,
      storage_key: "photos/batch-#{n}.jpg",
      url: "/uploads/photos/batch-#{n}.jpg",
      position: rem(n - 1, 4) + 1,
      is_active: active
    })
    |> Repo.insert!()
  end

  defp intent!(profile, n, expires_at) do
    %ProfilePhotoUploadIntent{}
    |> ProfilePhotoUploadIntent.changeset(%{
      profile_id: profile.id,
      storage_key: "photos/intent-#{n}.jpg",
      public_url: "/uploads/photos/intent-#{n}.jpg",
      position: 1,
      content_type: "image/jpeg",
      size_bytes: 100,
      expires_at: expires_at
    })
    |> Repo.insert!()
  end

  defp queries(fun) do
    ref = make_ref()
    handler = {__MODULE__, ref}
    :ok = :telemetry.attach(handler, [:cherry, :repo, :query], &__MODULE__.query/4, {self(), ref})

    try do
      {fun.(), collect_queries(ref)}
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
