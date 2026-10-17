defmodule Cherry.Recovery do
  @moduledoc "Offline recovery gate. Run only against an isolated restored database."
  import Ecto.Query
  alias Cherry.{Repo, Storage}
  alias Cherry.Dating.{Profile, ProfilePhoto, ProfilePhotoUploadIntent}

  def prepare! do
    unless System.get_env("CHERRY_ISOLATED_RECOVERY") == "true" do
      raise "refusing recovery without CHERRY_ISOLATED_RECOVERY=true and an isolated database"
    end

    unless Storage.adapter() == Cherry.Storage.R2 and Cherry.Recovery.Journal.enabled?() do
      raise "recovery requires private R2 and the external erasure journal"
    end

    # All requests, even those older than the snapshot or already acknowledged.
    case Cherry.Recovery.Journal.replay(all: true) do
      {:ok, _} -> :ok
      _ -> raise "external erasure journal unavailable or pending: DO NOT REOPEN"
    end

    if Repo.exists?(Cherry.Accounts.ErasureTask, log: false),
      do: raise("external erasure queue still pending: DO NOT REOPEN")

    now = DateTime.utc_now() |> DateTime.truncate(:second)

    Repo.transaction(fn ->
      Repo.delete_all(Cherry.Sessions.PushToken, log: false)
      Repo.delete_all(Cherry.Sessions.RefreshToken, log: false)
      Repo.delete_all(Cherry.Sessions.SessionFamily, log: false)
      Repo.delete_all(Cherry.Sessions.Device, log: false)
      Repo.delete_all(Cherry.Backoffice.Credential, log: false)
      Repo.delete_all(Oban.Job, log: false)
      Repo.update_all(ProfilePhotoUploadIntent, set: [expires_at: DateTime.add(now, -600)])
    end)
    |> case do
      {:ok, _} -> :ok
      _ -> raise "session invalidation failed: DO NOT REOPEN"
    end

    # A 403 or timeout is NOT a missing image; preserve galleries and stop.
    Repo.all(from(p in ProfilePhoto, where: p.is_active), log: false)
    |> Enum.each(fn photo ->
      case Cherry.Storage.R2.object_exists?(photo.storage_key) do
        {:ok, true} ->
          # Old snapshots contain local /uploads URLs; keys survive the move.
          {:ok, reference} = Cherry.Storage.R2.public_url(photo.storage_key)

          Repo.update_all(from(p in ProfilePhoto, where: p.id == ^photo.id),
            set: [url: reference]
          )

        {:ok, false} ->
          Repo.update_all(from(p in ProfilePhoto, where: p.id == ^photo.id),
            set: [is_active: false, storage_deleted_at: now]
          )

        _ ->
          raise "photo reconciliation unavailable: DO NOT REOPEN"
      end
    end)

    Repo.all(Profile, log: false)
    |> Enum.each(&Cherry.Dating.sync_completed_profile_state/1)

    :ok
  end

  @doc "Final offline step: preserve valid galleries, erase only unassociated objects."
  def reconcile_storage! do
    unless System.get_env("CHERRY_ISOLATED_RECOVERY") == "true" and
             System.get_env("CHERRY_RECOVERY_UPLOADS_QUIESCED") == "true" do
      raise "stop all production writers and wait the upload TTL plus grace before reconciling storage"
    end

    # Recheck the external registry at the last destructive recovery step too.
    case Cherry.Recovery.Journal.replay(all: true) do
      {:ok, _} -> :ok
      _ -> raise "erasure journal unavailable or pending: DO NOT REOPEN"
    end

    keep =
      Repo.all(
        from(p in ProfilePhoto,
          where: p.is_active and is_nil(p.storage_deleted_at),
          select: p.storage_key
        )
      )
      |> MapSet.new()

    case Cherry.Storage.R2.list_objects() do
      {:ok, keys} ->
        Enum.each(keys, fn key ->
          unless MapSet.member?(keep, key) do
            with :ok <- Storage.delete_object(key),
                 {:ok, false} <- Cherry.Storage.R2.object_exists?(key) do
              :ok
            else
              _ -> raise "orphan object deletion unconfirmed: DO NOT REOPEN"
            end
          end
        end)

      _ ->
        raise "object inventory unavailable: DO NOT REOPEN"
    end

    :ok
  end
end
