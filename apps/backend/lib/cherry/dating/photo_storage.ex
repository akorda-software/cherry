defmodule Cherry.Dating.PhotoStorage do
  @moduledoc """
  Borrado físico de objetos de fotos (`Cherry.Storage`).

    * `purge_photo/1`: al borrar una foto (`Cherry.Dating.delete_photo/1`).
    * `purge_user_photos/1`: al borrar una cuenta (`Cherry.Accounts.delete_account/1`).
    * `purge_user_storage/1`: al borrar una cuenta del todo
      (`Cherry.Accounts.purge_account/1`): fotos y subidas en curso, antes de
      borrar las filas, porque después nadie podría reintentarlo.
    * `sweep/1` (periódico, `Cherry.Dating.PhotoStorageSweeper`): reintenta lo
      anterior si el almacenamiento falló (fotos inactivas o de perfiles
      borrados aún con objeto) y limpia las subidas caducadas: borra el objeto
      en espera (`pending/`) de todo intent caducado y, si nunca se completó,
      también el definitivo (un `complete` que falló tras publicarlo).

  `storage_deleted_at` marca las filas ya limpiadas; los errores se reintentan
  en el siguiente barrido. Las claves que Cherry no gestiona (fotos demo
  enlazadas desde fuera) se marcan sin tocar nada (`Cherry.Storage.delete_object/1`).
  """

  import Ecto.Query

  require Logger

  alias Cherry.Accounts.User
  alias Cherry.Dating.Profile
  alias Cherry.Dating.ProfilePhoto
  alias Cherry.Dating.ProfilePhotoUploadIntent
  alias Cherry.Repo
  alias Cherry.Storage

  # An upload completing right at its expiry publishes before its transaction
  # commits: leave expired intents alone for a few minutes.
  @intent_grace_seconds 5 * 60
  @default_batch 200
  @max_batch 1000

  @doc "Borra el objeto de una foto ya inactiva. Devuelve la foto (marcada si se borró)."
  def purge_photo(%ProfilePhoto{storage_deleted_at: nil} = photo) do
    if purge_photo_object(photo) do
      mark_photos([photo.id])
      %{photo | storage_deleted_at: now()}
    else
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
  Borra los objetos de todas las fotos y subidas (intents) de los perfiles de
  `user_id`. Devuelve `:ok` o `{:error, claves}` con los objetos que no se han
  podido borrar (las claves son aleatorias, sin datos de la persona).
  """
  def purge_user_storage(user_id) do
    purge_user_photos(user_id)

    from(i in ProfilePhotoUploadIntent,
      join: p in Profile,
      on: p.id == i.profile_id,
      where: p.user_id == ^user_id and is_nil(i.storage_deleted_at)
    )
    |> Repo.all()
    |> Enum.filter(&purge_intent/1)
    |> mark_intents()

    photos =
      from(ph in ProfilePhoto,
        join: p in Profile,
        on: p.id == ph.profile_id,
        where: p.user_id == ^user_id and is_nil(ph.storage_deleted_at),
        select: ph.storage_key
      )

    intents =
      from(i in ProfilePhotoUploadIntent,
        join: p in Profile,
        on: p.id == i.profile_id,
        where: p.user_id == ^user_id and is_nil(i.storage_deleted_at),
        select: i.storage_key
      )

    case Repo.all(photos) ++ Repo.all(intents) do
      [] -> :ok
      keys -> {:error, keys}
    end
  end

  @doc """
  Un barrido: como máximo `batch` fotos y `batch` intents caducados (1–1000,
  por defecto #{@default_batch}). Devuelve `%{photos: n, intents: n}` (filas
  limpiadas). Solo marca los objetos borrados con éxito, en una escritura por
  tipo, sin mantener una transacción abierta durante las llamadas al storage.
  """
  def sweep(now \\ DateTime.utc_now(), batch \\ @default_batch) do
    batch_size!(batch)
    %{photos: sweep_photos(batch), intents: sweep_intents(now, batch)}
  end

  @doc "Valida el tamaño de lote de limpieza; sin argumento devuelve el predeterminado."
  def batch_size!(batch \\ @default_batch)
  def batch_size!(batch) when is_integer(batch) and batch in 1..@max_batch, do: batch

  def batch_size!(_batch),
    do: raise(ArgumentError, "photo storage batch size must be between 1 and #{@max_batch}")

  defp sweep_photos(batch) do
    from(ph in ProfilePhoto,
      join: p in Profile,
      on: p.id == ph.profile_id,
      join: u in User,
      on: u.id == p.user_id,
      where: is_nil(ph.storage_deleted_at),
      where: not ph.is_active or not is_nil(p.deleted_at) or not is_nil(u.deleted_at),
      limit: ^batch,
      select: %{id: ph.id, storage_key: ph.storage_key}
    )
    |> Repo.all()
    |> Enum.filter(&purge_photo_object/1)
    |> Enum.map(& &1.id)
    |> mark_photos()
    |> elem(0)
  end

  defp purge_photo_object(photo) do
    case Storage.delete_object(photo.storage_key) do
      :ok ->
        true

      {:error, reason} ->
        log_failure("photo #{photo.id}", reason)
        false
    end
  end

  defp sweep_intents(now, batch) do
    cutoff = now |> DateTime.add(-@intent_grace_seconds, :second) |> DateTime.truncate(:second)

    from(i in ProfilePhotoUploadIntent,
      where: is_nil(i.storage_deleted_at) and i.expires_at < ^cutoff,
      limit: ^batch
    )
    |> Repo.all()
    |> Enum.filter(&purge_intent/1)
    |> mark_intents()
  end

  # A completed intent's final object is a photo (purged with it): only the
  # pending one is left. Otherwise both may exist.
  defp purge_intent(%ProfilePhotoUploadIntent{} = intent) do
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
  end

  defp mark_intents([]), do: 0

  defp mark_intents(intents) do
    ids = Enum.map(intents, & &1.id)

    {count, _} =
      Repo.update_all(from(i in ProfilePhotoUploadIntent, where: i.id in ^ids),
        set: [storage_deleted_at: now()]
      )

    count
  end

  defp mark_photos([]), do: {0, nil}

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
