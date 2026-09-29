defmodule Snack.Storage do
  @moduledoc """
  Almacenamiento de fotos de perfil con adaptadores intercambiables.

  El flujo del móvil es el mismo con cualquier adaptador:

    1. `POST /api/me/photos/upload-intent` → `presign_put/3` devuelve una URL de
       subida de un solo uso (`uploadUrl`), el método y los headers obligatorios.
       La subida va a la zona de espera `pending/<storage_key>`, que no se
       publica (`publicUrl` apunta ya a la clave definitiva).
    2. El móvil sube el binario con `PUT uploadUrl` y todos los headers.
    3. `POST /api/me/photos/complete` → `verify_upload/1` comprueba el objeto
       (existencia, tamaño exacto, MIME y cabecera binaria) y `publish_upload/1`
       lo mueve a su clave definitiva, la única que se sirve.

  Claves: `photos/<aleatorio>.<ext>` (sin id de perfil). Las antiguas
  `profiles/<profile_id>/...` se siguen sirviendo y borrando. Los objetos de
  fotos borradas, de cuentas borradas y de intents caducados sin completar se
  eliminan físicamente (`Snack.Dating.PhotoStorage`).

  Adaptadores:

    * `Snack.Storage.Local` — disco local servido por Phoenix (`/uploads/...`).
      Pensado para desarrollo e instancias self-hosted sin S3.
    * `Snack.Storage.R2` — Cloudflare R2 o cualquier servicio S3 compatible
      (MinIO, Garage...) mediante `:endpoint`.

  Se elige con `config :snack, Snack.Storage, adapter: ...` (env `STORAGE_ADAPTER`).
  """

  @typedoc "Límites vigentes para crear un intent de subida."
  @type upload_config :: %{
          allowed_content_types: [String.t()],
          max_upload_bytes: pos_integer(),
          expires_at: DateTime.t(),
          ttl_seconds: pos_integer()
        }

  @typedoc """
  Subida firmada. `upload_url`/`public_url` pueden ser rutas relativas
  (adaptador local); la capa web las convierte en absolutas.
  """
  @type signed_upload :: %{
          storage_key: String.t(),
          upload_url: String.t(),
          public_url: String.t(),
          method: String.t(),
          headers: %{String.t() => String.t()},
          expires_at: DateTime.t(),
          max_bytes: pos_integer()
        }

  @typedoc "Lo mínimo de un intent que necesita `verify_upload/1`."
  @type upload_intent :: %{
          required(:storage_key) => String.t(),
          required(:content_type) => String.t(),
          required(:size_bytes) => pos_integer(),
          optional(atom()) => any()
        }

  @callback upload_config(now :: DateTime.t()) :: {:ok, upload_config()} | {:error, atom()}

  @callback presign_put(
              storage_key :: String.t(),
              content_type :: String.t(),
              now :: DateTime.t()
            ) ::
              {:ok, signed_upload()} | {:error, atom()}

  @callback verify_upload(upload_intent()) :: :ok | {:error, atom()}

  @callback public_url(storage_key :: String.t()) :: {:ok, String.t()} | {:error, atom()}

  @doc """
  Mueve `from` a `to` (servidor a servidor). `{:error, :upload_object_not_found}`
  si `from` no existe.
  """
  @callback promote(from :: String.t(), to :: String.t()) :: :ok | {:error, atom()}

  @doc "Borra un objeto. Borrar uno inexistente es `:ok`."
  @callback delete_object(storage_key :: String.t()) :: :ok | {:error, atom()}

  @doc "Adaptador configurado, o `nil` si no hay ninguno."
  @spec adapter() :: module() | nil
  def adapter do
    :snack
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:adapter)
  end

  @pending_prefix "pending/"
  @managed_prefixes ["photos/", "profiles/", @pending_prefix]

  def upload_config(now \\ DateTime.utc_now()), do: dispatch(:upload_config, [now])

  @doc """
  Firma la subida de `storage_key` hacia su zona de espera (`pending_key/1`).
  `storage_key` y `public_url` del resultado son los definitivos.
  """
  def presign_put(storage_key, content_type, now \\ DateTime.utc_now()) do
    with {:ok, signed} <- dispatch(:presign_put, [pending_key(storage_key), content_type, now]),
         {:ok, public_url} <- public_url(storage_key) do
      {:ok, %{signed | storage_key: storage_key, public_url: public_url}}
    end
  end

  @doc """
  Verifica el objeto subido para un intent: en la zona de espera o, si ya no
  está ahí, en la clave definitiva (reintento tras publicar, o intents antiguos
  que subían directamente a la clave definitiva).
  """
  def verify_upload(%{storage_key: storage_key} = intent) do
    case dispatch(:verify_upload, [%{intent | storage_key: pending_key(storage_key)}]) do
      {:error, :upload_object_not_found} -> dispatch(:verify_upload, [intent])
      result -> result
    end
  end

  @doc """
  Publica un objeto ya verificado: lo mueve de la zona de espera a su clave
  definitiva. Si ya no está en espera es que ya se publicó (o es un intent
  antiguo): `verify_upload/1` acaba de encontrarlo en la clave definitiva.
  """
  def publish_upload(%{storage_key: storage_key}) do
    case dispatch(:promote, [pending_key(storage_key), storage_key]) do
      {:error, :upload_object_not_found} -> :ok
      result -> result
    end
  end

  def public_url(storage_key), do: dispatch(:public_url, [storage_key])

  @doc """
  Borra físicamente un objeto gestionado por Snack (`photos/`, `profiles/`,
  `pending/`). Las claves ajenas (p. ej. fotos demo enlazadas desde fuera) no
  se tocan y cuentan como borradas.
  """
  def delete_object(storage_key) when is_binary(storage_key) do
    if managed_key?(storage_key), do: dispatch(:delete_object, [storage_key]), else: :ok
  end

  @doc "Borra el objeto definitivo y el de la zona de espera de una subida."
  def delete_upload_objects(storage_key) do
    with :ok <- delete_object(pending_key(storage_key)) do
      delete_object(storage_key)
    end
  end

  @doc "Clave de la zona de espera (no pública) de `storage_key`."
  def pending_key(@pending_prefix <> _rest = storage_key), do: storage_key
  def pending_key(storage_key), do: @pending_prefix <> storage_key

  @doc "Clave definitiva de una clave en espera (`nil` si no lo es)."
  def published_key(@pending_prefix <> storage_key), do: storage_key
  def published_key(_storage_key), do: nil

  @doc "¿Es una clave de un objeto que Snack sube y puede borrar?"
  def managed_key?(storage_key) when is_binary(storage_key),
    do: String.starts_with?(storage_key, @managed_prefixes)

  def managed_key?(_storage_key), do: false

  @doc "Nueva clave aleatoria para una foto (sin datos del perfil)."
  def new_photo_key(content_type) do
    "photos/" <>
      Base.encode16(:crypto.strong_rand_bytes(16), case: :lower) <>
      "." <> extension_for(content_type)
  end

  defp dispatch(function, args) do
    case adapter() do
      nil -> {:error, :storage_not_configured}
      adapter -> apply(adapter, function, args)
    end
  end

  @doc """
  Comprueba la firma binaria (magic bytes) de una imagen frente al MIME declarado.
  Solo mira la cabecera: no decodifica la imagen completa.
  """
  @spec image_signature?(binary(), String.t()) :: boolean()
  def image_signature?(<<255, 216, 255, _::binary>>, "image/jpeg"), do: true
  def image_signature?(<<137, 80, 78, 71, 13, 10, 26, 10, _::binary>>, "image/png"), do: true

  def image_signature?(
        <<"RIFF", _::binary-size(4), "WEBP", chunk::binary-size(4), _::binary>>,
        "image/webp"
      ),
      do: chunk in ["VP8 ", "VP8L", "VP8X"]

  def image_signature?(_bytes, _content_type), do: false

  @doc "Bytes de cabecera necesarios para `image_signature?/2`."
  def signature_sample_bytes, do: 32

  @doc "Extensión de fichero asociada a cada MIME admitido."
  @spec extension_for(String.t()) :: String.t()
  def extension_for("image/jpeg"), do: "jpg"
  def extension_for("image/png"), do: "png"
  def extension_for("image/webp"), do: "webp"
  def extension_for(_content_type), do: "bin"

  @doc "MIME esperado para la extensión de una storage key (`nil` si no es una imagen admitida)."
  @spec content_type_for_key(String.t()) :: String.t() | nil
  def content_type_for_key(storage_key) do
    case storage_key |> Path.extname() |> String.downcase() do
      ".jpg" -> "image/jpeg"
      ".jpeg" -> "image/jpeg"
      ".png" -> "image/png"
      ".webp" -> "image/webp"
      _other -> nil
    end
  end
end
