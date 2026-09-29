defmodule Snack.Dating.PhotoStorage do
  @moduledoc """
  Borrado físico de objetos de fotos (`Snack.Storage`).

    * `purge_photo/1`: al borrar una foto (`Snack.Dating.delete_photo/1`).
    * `purge_user_photos/1`: al borrar una cuenta (`Snack.Accounts.delete_account/1`).
    * `sweep/1` (periódico, `Snack.Dating.PhotoStorageSweeper`): reintenta lo
      anterior si el almacenamiento falló (fotos inactivas o de perfiles
      borrados aún con objeto) y limpia las subidas caducadas: borra el objeto
      en espera (`pending/`) de todo intent caducado y, si nunca se completó,
      también el definitivo (un `complete` que falló tras publicarlo).

  `storage_deleted_at` marca las filas ya limpiadas; los errores se reintentan
  en el siguiente barrido. Las claves que Snack no gestiona (fotos demo
  enlazadas desde fuera) se marcan sin tocar nada (`Snack.Storage.delete_object/1`).
  """

  import Ecto.Query

  require Logger

  alias Snack.Accounts.User
  alias Snack.Dating.Profile
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.ProfilePhotoUploadIntent
  alias Snack.Repo
  alias Snack.Storage

  # An upload completing right at its expiry publishes before its transaction
  # commits: leave expired intents alone for a few minutes.
  @intent_grace_seconds 5 * 60
  @default_batch 200

  @doc "Borra el objeto de una foto ya inactiva. Devuelve la foto (marcada si se borró)."
  def purge_photo(%ProfilePhoto{storage_deleted_at: nil} = photo) do
    case Storage.delete_object(photo.storage_key) do
      :ok ->
        mark_photos([photo.id])
        %{photo | storage_deleted_at: now()}

      {:error, reason} ->
        log_failure("photo #{photo.id}", reason)
        photo
    end
  end

  def purge_photo(%ProfilePhoto{} = photo), do: photo

  @doc "Borra los objetos de todas las fotos de los perfiles de `user_id`."
  def purge_user_photos(user_id) do
    from(ph in ProfilePhoto,
      join: p in Profile,
      on: p.id == ph.profile_id,
      where: p.user_id == ^user_id and is_nil(ph.storage_deleted_at)
    )
    |> Repo.all()
    |> Enum.each(&purge_photo/1)
  end

  @doc """
  Un barrido: fotos pendientes de borrar e intents caducados. Devuelve
  `%{photos: n, intents: n}` (filas limpiadas).
  """
  def sweep(now \\ DateTime.utc_now(), batch \\ @default_batch) do
    %{photos: sweep_photos(batch), intents: sweep_intents(now, batch)}
  end

  defp sweep_photos(batch) do
    from(ph in ProfilePhoto,
      join: p in Profile,
      on: p.id == ph.profile_id,
      join: u in User,
      on: u.id == p.user_id,
      where: is_nil(ph.storage_deleted_at),
      where: not ph.is_active or not is_nil(p.deleted_at) or not is_nil(u.deleted_at),
      limit: ^batch
    )
    |> Repo.all()
    |> Enum.map(&purge_photo/1)
    |> Enum.count(&(&1.storage_deleted_at != nil))
  end

  defp sweep_intents(now, batch) do
    cutoff = now |> DateTime.add(-@intent_grace_seconds, :second) |> DateTime.truncate(:second)

    cleaned =
      from(i in ProfilePhotoUploadIntent,
        where: is_nil(i.storage_deleted_at) and i.expires_at < ^cutoff,
        limit: ^batch
      )
      |> Repo.all()
      |> Enum.filter(fn intent ->
        result =
          if intent.completed_at,
            do: Storage.delete_object(Storage.pending_key(intent.storage_key)),
            else: Storage.delete_upload_objects(intent.storage_key)

        case result do
          :ok ->
            true

          {:error, reason} ->
            log_failure("upload intent #{intent.id}", reason)
            false
        end
      end)
      |> Enum.map(& &1.id)

    {count, _} =
      Repo.update_all(from(i in ProfilePhotoUploadIntent, where: i.id in ^cleaned),
        set: [storage_deleted_at: now()]
      )

    count
  end

  defp mark_photos(ids) do
    Repo.update_all(from(ph in ProfilePhoto, where: ph.id in ^ids),
      set: [storage_deleted_at: now()]
    )
  end

  # Without storage configured (tests, instances without photos) there is
  # nothing to delete yet; the sweeper retries once it is.
  defp log_failure(_what, :storage_not_configured), do: :ok

  defp log_failure(what, reason),
    do: Logger.warning("Photo storage cleanup failed for #{what}: #{inspect(reason)}")

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
