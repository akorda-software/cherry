defmodule Snack.Storage do
  @moduledoc """
  Almacenamiento de fotos de perfil con adaptadores intercambiables.

  El flujo del móvil es el mismo con cualquier adaptador:

    1. `POST /api/me/photos/upload-intent` → `presign_put/3` devuelve una URL de
       subida de un solo uso (`uploadUrl`), el método y los headers obligatorios.
    2. El móvil sube el binario con `PUT uploadUrl` y todos los headers.
    3. `POST /api/me/photos/complete` → `verify_upload/1` comprueba el objeto
       (existencia, tamaño exacto, MIME y cabecera binaria) antes de publicarlo.

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

  @doc "Adaptador configurado, o `nil` si no hay ninguno."
  @spec adapter() :: module() | nil
  def adapter do
    :snack
    |> Application.get_env(__MODULE__, [])
    |> Keyword.get(:adapter)
  end

  def upload_config(now \\ DateTime.utc_now()), do: dispatch(:upload_config, [now])

  def presign_put(storage_key, content_type, now \\ DateTime.utc_now()),
    do: dispatch(:presign_put, [storage_key, content_type, now])

  def verify_upload(intent), do: dispatch(:verify_upload, [intent])

  def public_url(storage_key), do: dispatch(:public_url, [storage_key])

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
