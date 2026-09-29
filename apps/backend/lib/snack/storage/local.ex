defmodule Snack.Storage.Local do
  @moduledoc """
  Almacenamiento de fotos en disco local, para desarrollo e instancias
  self-hosted sin servicio S3.

  Mantiene el mismo contrato que R2 para el móvil:

    * `presign_put/3` devuelve `upload_url = /api/uploads/<token>`, donde el
      token (`Phoenix.Token`) firma la storage key, el MIME, el tamaño máximo y
      la caducidad (= TTL del intent). La ruta es pública: el token autoriza.
    * `PUT /api/uploads/<token>` escribe el objeto en la zona de espera
      `uploads_dir/pending/<storage_key>` de forma atómica (fichero temporal +
      enlace duro) y nunca sobrescribe: si el objeto ya existe (en espera o ya
      publicado) responde 412, igual que `If-None-Match: *` en S3.
    * `promote/2` (al completar) lo mueve a `uploads_dir/<storage_key>`.
    * Solo se sirven `photos/` y `profiles/` (claves antiguas) con `Plug.Static`
      en `/uploads/<storage_key>`; `pending/` y `.tmp/` nunca. En BD se guarda
      la ruta relativa; la API la devuelve absoluta con `SnackWeb.MediaUrl`.

  Configuración (`config :snack, Snack.Storage.Local`): `:uploads_dir`,
  `:max_upload_bytes`, `:upload_url_ttl_seconds`, `:allowed_content_types`.
  """

  @behaviour Snack.Storage

  alias Snack.Storage

  @config_key __MODULE__
  @token_salt "snack-local-photo-upload-v1"
  @max_token_bytes 2048
  @upload_path_prefix "/api/uploads/"
  @public_path_prefix "/uploads/"
  @tmp_dir_name ".tmp"
  @stale_tmp_seconds 3600
  @defaults [
    allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
    max_upload_bytes: 2_000_000,
    upload_url_ttl_seconds: 600
  ]

  defmodule Upload do
    @moduledoc false
    @enforce_keys [:fd, :tmp_path, :dest_path, :storage_key, :content_type, :max_bytes]
    defstruct [
      :fd,
      :tmp_path,
      :dest_path,
      :storage_key,
      :content_type,
      :max_bytes,
      bytes: 0,
      head: ""
    ]
  end

  # ── Behaviour ─────────────────────────────────────────────────────────

  @impl Snack.Storage
  def upload_config(now \\ DateTime.utc_now()) do
    with {:ok, config} <- fetch_config() do
      ttl_seconds = config[:upload_url_ttl_seconds]

      {:ok,
       %{
         allowed_content_types: config[:allowed_content_types],
         max_upload_bytes: config[:max_upload_bytes],
         expires_at: DateTime.add(now, ttl_seconds, :second),
         ttl_seconds: ttl_seconds
       }}
    end
  end

  @impl Snack.Storage
  def presign_put(storage_key, content_type, now \\ DateTime.utc_now()) do
    with {:ok, config} <- fetch_config(),
         {:ok, _path} <- object_path(storage_key) do
      ttl_seconds = config[:upload_url_ttl_seconds]
      max_bytes = config[:max_upload_bytes]

      token =
        Phoenix.Token.sign(
          SnackWeb.Endpoint,
          @token_salt,
          %{"k" => storage_key, "t" => content_type, "m" => max_bytes},
          signed_at: DateTime.to_unix(now),
          max_age: ttl_seconds
        )

      {:ok,
       %{
         storage_key: storage_key,
         upload_url: @upload_path_prefix <> token,
         public_url: @public_path_prefix <> storage_key,
         method: "PUT",
         headers: %{"Content-Type" => content_type, "If-None-Match" => "*"},
         expires_at: DateTime.add(now, ttl_seconds, :second),
         max_bytes: max_bytes
       }}
    end
  end

  @impl Snack.Storage
  def verify_upload(%{storage_key: storage_key, content_type: content_type} = intent) do
    with {:ok, config} <- fetch_config(),
         {:ok, path} <- object_path(storage_key),
         {:ok, size} <- regular_file_size(path),
         :ok <- validate_size(size, intent.size_bytes, config[:max_upload_bytes]),
         :ok <- validate_content_type(storage_key, content_type),
         {:ok, head} <- read_head(path) do
      if Storage.image_signature?(head, content_type),
        do: :ok,
        else: {:error, :upload_invalid_image}
    else
      {:error, :invalid_storage_key} -> {:error, :upload_object_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl Snack.Storage
  def public_url(storage_key) do
    with {:ok, _path} <- object_path(storage_key) do
      {:ok, @public_path_prefix <> storage_key}
    end
  end

  @impl Snack.Storage
  def promote(from_key, to_key) do
    with {:ok, from_path} <- object_path(from_key),
         {:ok, to_path} <- object_path(to_key) do
      cond do
        not File.regular?(from_path) ->
          {:error, :upload_object_not_found}

        File.mkdir_p(Path.dirname(to_path)) != :ok ->
          {:error, :storage_unavailable}

        true ->
          case publish(from_path, to_path) do
            # Random keys: an existing destination is this same upload,
            # published by an earlier attempt.
            result when result in [:ok, {:error, :upload_already_exists}] ->
              _ = File.rm(from_path)
              :ok

            {:error, reason} ->
              {:error, reason}
          end
      end
    else
      {:error, :invalid_storage_key} -> {:error, :upload_object_not_found}
    end
  end

  @impl Snack.Storage
  def delete_object(storage_key) do
    with {:ok, path} <- object_path(storage_key) do
      case File.rm(path) do
        :ok -> :ok
        {:error, :enoent} -> :ok
        {:error, _reason} -> {:error, :storage_unavailable}
      end
    else
      # Nothing we could have stored there.
      {:error, :invalid_storage_key} -> :ok
    end
  end

  # ── Upload endpoint support (`PUT /api/uploads/:token`) ───────────────

  @doc """
  Verifica un token de subida. Devuelve la storage key, el MIME exigido y el
  tamaño máximo firmados, o `:upload_token_expired` / `:upload_token_invalid`.
  """
  def verify_upload_token(token) when is_binary(token) and byte_size(token) <= @max_token_bytes do
    case Phoenix.Token.verify(SnackWeb.Endpoint, @token_salt, token) do
      {:ok, %{"k" => storage_key, "t" => content_type, "m" => max_bytes}}
      when is_binary(storage_key) and is_binary(content_type) and is_integer(max_bytes) and
             max_bytes > 0 ->
        case object_path(storage_key) do
          {:ok, _path} ->
            {:ok, %{storage_key: storage_key, content_type: content_type, max_bytes: max_bytes}}

          {:error, _reason} ->
            {:error, :upload_token_invalid}
        end

      {:error, :expired} ->
        {:error, :upload_token_expired}

      _invalid ->
        {:error, :upload_token_invalid}
    end
  end

  def verify_upload_token(_token), do: {:error, :upload_token_invalid}

  @doc """
  Prepara la escritura de un objeto: comprueba que no exista y abre un fichero
  temporal dentro de `uploads_dir` (mismo sistema de ficheros, para poder
  publicarlo con un enlace duro atómico).
  """
  def begin_upload(%{storage_key: storage_key, content_type: content_type, max_bytes: max_bytes}) do
    with {:ok, dest_path} <- object_path(storage_key),
         false <- File.exists?(dest_path) or published?(storage_key),
         tmp_dir = Path.join(uploads_dir(), @tmp_dir_name),
         :ok <- File.mkdir_p(tmp_dir),
         :ok <- sweep_stale_tmp(tmp_dir),
         tmp_path = Path.join(tmp_dir, random_name()),
         {:ok, fd} <- :file.open(tmp_path, [:write, :exclusive, :binary, :raw]) do
      {:ok,
       %Upload{
         fd: fd,
         tmp_path: tmp_path,
         dest_path: dest_path,
         storage_key: storage_key,
         content_type: content_type,
         max_bytes: max_bytes
       }}
    else
      true -> {:error, :upload_already_exists}
      {:error, :invalid_storage_key} -> {:error, :upload_token_invalid}
      {:error, _reason} -> {:error, :storage_unavailable}
    end
  end

  @doc "Añade un fragmento del cuerpo. Aborta si se supera el tamaño máximo firmado."
  def append_chunk(%Upload{} = upload, chunk) when is_binary(chunk) do
    bytes = upload.bytes + byte_size(chunk)

    if bytes > upload.max_bytes do
      abort_upload(upload)
      {:error, :upload_too_large}
    else
      case :file.write(upload.fd, chunk) do
        :ok ->
          {:ok, %{upload | bytes: bytes, head: keep_head(upload.head, chunk)}}

        {:error, _reason} ->
          abort_upload(upload)
          {:error, :storage_unavailable}
      end
    end
  end

  @doc """
  Cierra el temporal, valida la cabecera binaria y publica el objeto en su
  ruta definitiva sin sobrescribir nunca uno existente.
  """
  def finish_upload(%Upload{} = upload) do
    result =
      with :ok <- sync_and_close(upload),
           true <-
             upload.bytes > 0 and Storage.image_signature?(upload.head, upload.content_type),
           :ok <- File.mkdir_p(Path.dirname(upload.dest_path)) do
        publish(upload.tmp_path, upload.dest_path)
      else
        false -> {:error, :upload_invalid_image}
        {:error, _reason} -> {:error, :storage_unavailable}
      end

    _ = File.rm(upload.tmp_path)
    result
  end

  @doc "Descarta una subida a medias (cierra y borra el temporal)."
  def abort_upload(%Upload{} = upload) do
    _ = :file.close(upload.fd)
    _ = File.rm(upload.tmp_path)
    :ok
  end

  # ── Paths & config ────────────────────────────────────────────────────

  @doc """
  Directorio raíz de los objetos. Siempre devuelve una ruta absoluta
  (`priv/uploads` de la app si no se ha configurado), así `Plug.Static`
  nunca sirve desde una raíz inesperada.
  """
  def uploads_dir do
    case Keyword.get(Application.get_env(:snack, @config_key, []), :uploads_dir) do
      dir when is_binary(dir) and dir != "" -> Path.expand(dir)
      _unset -> Application.app_dir(:snack, "priv/uploads")
    end
  end

  @doc "Ruta absoluta de un objeto, rechazando claves que escapen del directorio."
  def object_path(storage_key) when is_binary(storage_key) do
    with false <- storage_key == "" or String.contains?(storage_key, ["\\", "\0", ":"]),
         {:ok, relative} <- Path.safe_relative(storage_key, uploads_dir()),
         false <- relative |> Path.split() |> Enum.any?(&String.starts_with?(&1, ".")) do
      {:ok, Path.join(uploads_dir(), relative)}
    else
      _invalid -> {:error, :invalid_storage_key}
    end
  end

  def object_path(_storage_key), do: {:error, :invalid_storage_key}

  defp fetch_config do
    config = Keyword.merge(@defaults, Application.get_env(:snack, @config_key, []))

    valid? =
      positive_integer?(config[:max_upload_bytes]) and
        positive_integer?(config[:upload_url_ttl_seconds]) and
        is_list(config[:allowed_content_types]) and config[:allowed_content_types] != []

    if valid?, do: {:ok, config}, else: {:error, :storage_not_configured}
  end

  defp positive_integer?(value), do: is_integer(value) and value > 0

  # ── Helpers ───────────────────────────────────────────────────────────

  defp regular_file_size(path) do
    case File.stat(path) do
      {:ok, %File.Stat{type: :regular, size: size}} -> {:ok, size}
      {:ok, %File.Stat{}} -> {:error, :upload_object_not_found}
      {:error, :enoent} -> {:error, :upload_object_not_found}
      {:error, :enotdir} -> {:error, :upload_object_not_found}
      {:error, _reason} -> {:error, :storage_unavailable}
    end
  end

  defp validate_size(size, expected_size, max_bytes) do
    if size > 0 and size <= max_bytes and size == expected_size,
      do: :ok,
      else: {:error, :upload_size_mismatch}
  end

  defp validate_content_type(storage_key, content_type) do
    if Storage.content_type_for_key(storage_key) == content_type,
      do: :ok,
      else: {:error, :upload_content_type_mismatch}
  end

  defp read_head(path) do
    case :file.open(path, [:read, :binary, :raw]) do
      {:ok, fd} ->
        result = :file.read(fd, Storage.signature_sample_bytes())
        _ = :file.close(fd)

        case result do
          {:ok, head} -> {:ok, head}
          :eof -> {:ok, ""}
          {:error, _reason} -> {:error, :storage_unavailable}
        end

      {:error, _reason} ->
        {:error, :storage_unavailable}
    end
  end

  defp keep_head(head, chunk) do
    missing = Storage.signature_sample_bytes() - byte_size(head)

    if missing > 0,
      do: head <> binary_part(chunk, 0, min(missing, byte_size(chunk))),
      else: head
  end

  # The descriptor is always closed, even when datasync fails.
  defp sync_and_close(%Upload{fd: fd}) do
    synced = :file.datasync(fd)
    closed = :file.close(fd)

    case {synced, closed} do
      {:ok, :ok} -> :ok
      {{:error, reason}, _closed} -> {:error, reason}
      {:ok, {:error, reason}} -> {:error, reason}
    end
  end

  # A re-PUT of a pending key must not recreate it once it has been published.
  defp published?(storage_key) do
    case Storage.published_key(storage_key) do
      nil ->
        false

      published_key ->
        case object_path(published_key) do
          {:ok, path} -> File.exists?(path)
          {:error, _invalid} -> false
        end
    end
  end

  # `link(2)` falla con :eexist si el destino ya existe: publicación atómica y
  # sin sobrescritura. Si el sistema de ficheros no admite enlaces duros se
  # recurre a comprobar + renombrar (ventana de carrera mínima).
  defp publish(tmp_path, dest_path) do
    case File.ln(tmp_path, dest_path) do
      :ok ->
        :ok

      {:error, :eexist} ->
        {:error, :upload_already_exists}

      {:error, reason} when reason in [:enotsup, :eperm, :exdev, :emlink] ->
        cond do
          File.exists?(dest_path) -> {:error, :upload_already_exists}
          File.rename(tmp_path, dest_path) == :ok -> :ok
          true -> {:error, :storage_unavailable}
        end

      {:error, _reason} ->
        {:error, :storage_unavailable}
    end
  end

  # Uploads killed mid-flight (e.g. the client vanished) can leave temp files.
  defp sweep_stale_tmp(tmp_dir) do
    cutoff = System.os_time(:second) - @stale_tmp_seconds

    with {:ok, names} <- File.ls(tmp_dir) do
      Enum.each(names, fn name ->
        path = Path.join(tmp_dir, name)

        case File.stat(path, time: :posix) do
          {:ok, %File.Stat{type: :regular, mtime: mtime}} when mtime < cutoff -> File.rm(path)
          _fresh_or_gone -> :ok
        end
      end)
    end

    :ok
  end

  defp random_name do
    Base.url_encode64(:crypto.strong_rand_bytes(18), padding: false) <> ".part"
  end
end
