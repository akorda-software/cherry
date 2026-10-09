import Config

if config_env() == :dev do
  [".env", ".env.local"]
  |> Enum.map(&Path.expand(&1, __DIR__ <> "/.."))
  |> Enum.filter(&File.exists?/1)
  |> Enum.each(fn path ->
    path
    |> File.read!()
    |> String.split(["\n", "\r\n"], trim: true)
    |> Enum.each(fn line ->
      trimmed = String.trim(line)

      if trimmed != "" and not String.starts_with?(trimmed, "#") do
        case String.split(trimmed, "=", parts: 2) do
          [key, value] ->
            if System.get_env(key) == nil do
              System.put_env(key, value)
            end

          _parts ->
            :ok
        end
      end
    end)
  end)
end

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/snack start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :snack, SnackWeb.Endpoint, server: true
end

config :snack, :app_version, System.get_env("APP_VERSION", "dev")

config :snack, :metrics_token, System.get_env("METRICS_TOKEN")

positive_env = fn name, default, maximum ->
  case Integer.parse(System.get_env(name, to_string(default))) do
    {value, ""} when value > 0 and value <= maximum -> value
    _ -> raise "#{name} must be an integer between 1 and #{maximum}"
  end
end

# Concurrency is per node. Keep HTTP and database capacity available when Expo
# slows down; increasing this requires measuring both its queue and the DB pool.
config :snack, Oban, queues: [push: positive_env.("PUSH_CONCURRENCY", 4, 32)]

# The feed is an OLTP query. Its estimates can trigger tens of milliseconds of
# JIT compilation for a shorter execution; keep this scoped to our connections.
database_jit =
  case System.get_env("DB_JIT", "false") do
    "false" -> "off"
    "true" -> "on"
    _ -> raise "DB_JIT must be true or false"
  end

config :snack, Snack.Repo, parameters: [jit: database_jit]

# En dev, DATABASE_URL (shell o .env) tiene prioridad sobre config/dev.exs para
# poder apuntar al PostGIS del compose (localhost:5510) sin tocar código.
if config_env() == :dev do
  case System.get_env("DATABASE_URL") do
    url when is_binary(url) and url != "" -> config :snack, Snack.Repo, url: url
    _url -> :ok
  end
end

port =
  case Integer.parse(System.get_env("PORT", "4000") |> String.trim()) do
    {port, ""} when port in 1..65_535 ->
      port

    _invalid ->
      raise """
      environment variable PORT is invalid: #{inspect(System.get_env("PORT"))}.
      Use an integer between 1 and 65535 (default 4000).
      """
  end

config :snack, SnackWeb.Endpoint, http: [port: port]

# Prod: every missing or weak required variable in a single error, so a fresh
# install is fixed in one pass instead of one restart per variable.
if config_env() == :prod do
  env = fn name -> System.get_env(name, "") |> String.trim() end

  placeholder? = fn value ->
    String.downcase(value) in ["cambiar", "change", "changeme", "change_me"]
  end

  missing =
    ~w(DATABASE_URL SECRET_KEY_BASE AUTH_ACCESS_TOKEN_SALT AUTH_REFRESH_TOKEN_SALT
       MESSAGE_ENCRYPTION_KEY PHX_HOST STORAGE_ADAPTER)
    |> Enum.filter(&(env.(&1) == ""))

  weak =
    [
      {"SECRET_KEY_BASE", 64},
      {"MESSAGE_ENCRYPTION_KEY", 32},
      {"AUTH_ACCESS_TOKEN_SALT", 32},
      {"AUTH_REFRESH_TOKEN_SALT", 32}
    ]
    |> Enum.reject(fn {name, _min} -> name in missing end)
    |> Enum.filter(fn {name, min} ->
      value = env.(name)
      String.length(value) < min or placeholder?.(value)
    end)

  if missing != [] or weak != [] do
    raise """
    invalid production configuration.
    #{Enum.map_join(missing, "", &"\n  - #{&1} is missing")}#{Enum.map_join(weak, "", fn {name, min} -> "\n  - #{name} is too weak (placeholder or shorter than #{min} characters)" end)}

    Generate each secret with `mix phx.gen.secret` (64 characters) or
    `openssl rand -base64 48`. PHX_HOST is the public host name of the API
    (e.g. api.snack.example); STORAGE_ADAPTER is local or r2.
    """
  end
end

split_csv_env = fn var, fallback ->
  System.get_env(var, fallback)
  |> case do
    nil ->
      []

    value ->
      value
      |> String.split(",", trim: true)
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
  end
end

# CORS: solo para clientes web (Expo Web en dev, instancias self-hosted con web).
# En dev se permite cualquier origen; fuera de dev, lista explícita separada por comas.
cors_allowed_origins =
  case System.get_env("CORS_ALLOWED_ORIGINS") do
    nil -> if config_env() == :dev, do: :any, else: []
    "*" -> :any
    _value -> split_csv_env.("CORS_ALLOWED_ORIGINS", nil)
  end

config :snack, :cors_allowed_origins, cors_allowed_origins

if config_env() != :test do
  google_web_client_id = System.get_env("GOOGLE_WEB_CLIENT_ID")

  google_ios_client_id = System.get_env("GOOGLE_IOS_CLIENT_ID")

  google_audiences =
    [google_web_client_id, google_ios_client_id]
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(&(&1 == ""))

  google_provider_config = [
    module: Snack.Identity.Providers.Google,
    audiences: google_audiences,
    issuers: ["https://accounts.google.com", "accounts.google.com"]
  ]

  apple_audiences =
    split_csv_env.(
      "APPLE_AUDIENCES",
      System.get_env("EXPO_IOS_BUNDLE_IDENTIFIER", "app.snack.mobile")
    )

  apple_provider_config = [
    module: Snack.Identity.Providers.Apple,
    audiences: apple_audiences,
    issuers: ["https://appleid.apple.com"]
  ]

  config :snack, Snack.Auth,
    providers: %{
      google: google_provider_config,
      apple: apple_provider_config
    }
end

config :snack, Snack.Identity.Providers.GoogleJwksCache,
  ttl_ms: String.to_integer(System.get_env("GOOGLE_JWKS_CACHE_TTL_MS", "600000"))

config :snack, Snack.Identity.Providers.AppleJwksCache,
  ttl_ms: String.to_integer(System.get_env("APPLE_JWKS_CACHE_TTL_MS", "600000"))

# ── Almacenamiento de fotos (D-2026-09-29) ─────────────────────────────
# STORAGE_ADAPTER=local|r2 (`s3` es alias de `r2`). dev: `local` por defecto
# (config/dev.exs); test: lo fijan config/test.exs y los tests; prod: obligatorio.
storage_adapter = System.get_env("STORAGE_ADAPTER", "") |> String.trim() |> String.downcase()
uploads_dir = System.get_env("UPLOADS_DIR", "") |> String.trim()
public_base_url = System.get_env("PUBLIC_BASE_URL", "") |> String.trim()

if config_env() != :test do
  case storage_adapter do
    "" ->
      if config_env() == :prod do
        raise """
        environment variable STORAGE_ADAPTER is missing.
        Use "local" (photos on disk under UPLOADS_DIR, served at /uploads) or
        "r2" (Cloudflare R2 or any S3-compatible service via S3_ENDPOINT).
        """
      end

    "local" ->
      config :snack, Snack.Storage, adapter: Snack.Storage.Local

    adapter when adapter in ["r2", "s3"] ->
      config :snack, Snack.Storage, adapter: Snack.Storage.R2

    other ->
      raise "invalid STORAGE_ADAPTER #{inspect(other)}: expected local, r2 or s3"
  end

  cond do
    uploads_dir != "" ->
      config :snack, Snack.Storage.Local, uploads_dir: uploads_dir

    config_env() == :prod and storage_adapter == "local" ->
      raise """
      environment variable UPLOADS_DIR is required with STORAGE_ADAPTER=local.
      Point it to a persistent volume (e.g. /var/lib/snack/uploads) and back it up.
      """

    true ->
      :ok
  end

  config :snack, Snack.Storage.Local,
    max_upload_bytes: String.to_integer(System.get_env("UPLOAD_MAX_BYTES", "2000000")),
    upload_url_ttl_seconds: String.to_integer(System.get_env("UPLOAD_URL_TTL_SECONDS", "600"))

  # Base absoluta de las URLs de medios relativas (almacenamiento local), p. ej.
  # https://api.snack.example. Sin definir ⇒ se usa el host de cada petición,
  # que el cliente controla (cabecera Host): en prod con `local` es obligatoria.
  if config_env() == :prod and storage_adapter == "local" do
    case URI.parse(public_base_url) do
      %URI{scheme: scheme, host: host}
      when scheme in ["http", "https"] and host not in [nil, ""] ->
        :ok

      _invalid ->
        raise """
        environment variable PUBLIC_BASE_URL is required with STORAGE_ADAPTER=local.
        Set it to the public origin of the API (e.g. https://api.snack.example):
        upload and photo URLs are built from it instead of the request Host header.
        """
    end
  end

  if public_base_url != "", do: config(:snack, :public_base_url, public_base_url)
end

s3_endpoint = System.get_env("S3_ENDPOINT", "") |> String.trim()

config :snack, Snack.Storage.R2,
  account_id: System.get_env("R2_ACCOUNT_ID"),
  # Endpoint S3 genérico (MinIO, Garage...). Vacío ⇒ R2 (<account_id>.r2.cloudflarestorage.com).
  endpoint: if(s3_endpoint != "", do: s3_endpoint),
  region: System.get_env("S3_REGION") || if(s3_endpoint != "", do: "us-east-1"),
  access_key_id: System.get_env("R2_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("R2_SECRET_ACCESS_KEY"),
  bucket_name: System.get_env("R2_BUCKET_NAME"),
  public_url_base: System.get_env("R2_PUBLIC_URL_BASE"),
  allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
  max_upload_bytes:
    String.to_integer(
      System.get_env("R2_MAX_UPLOAD_BYTES") || System.get_env("UPLOAD_MAX_BYTES", "2000000")
    ),
  upload_url_ttl_seconds:
    String.to_integer(
      System.get_env("R2_UPLOAD_URL_TTL_SECONDS") ||
        System.get_env("UPLOAD_URL_TTL_SECONDS", "600")
    )

config :snack, :expo_push,
  base_url: System.get_env("EXPO_PUSH_BASE_URL", "https://exp.host"),
  access_token: System.get_env("EXPO_PUSH_ACCESS_TOKEN"),
  receive_timeout_ms: positive_env.("EXPO_PUSH_RECEIVE_TIMEOUT_MS", 5000, 15_000)

# Cifrado en reposo de mensajes (D-2026-08-21).
#
# La clave se deriva de MESSAGE_ENCRYPTION_KEY (generar con `mix phx.gen.secret`)
# y nunca vive en la base de datos. En prod es obligatoria; en dev/test se usa
# un placeholder para que los entornos locales funcionen sin setup extra.
message_cipher_key = System.get_env("MESSAGE_ENCRYPTION_KEY", "") |> String.trim()

message_cipher_key =
  cond do
    message_cipher_key != "" ->
      message_cipher_key

    config_env() == :prod ->
      raise """
      environment variable MESSAGE_ENCRYPTION_KEY is missing.
      It is required to encrypt message bodies at rest.
      Generate one with: mix phx.gen.secret
      """

    true ->
      "__DEV_MESSAGE_CIPHER_KEY__"
  end

config :snack, :message_cipher, key: message_cipher_key

# ── Verificación de edad (D-2026-10-09) ────────────────────────────────
# DOCUMENT_FINGERPRINT_KEY: clave HMAC de la huella del documento (una persona,
# una cuenta). Sin ella, POST /api/me/verification/nfc responde 503. No se puede
# rotar: cambiarla deja huérfanas todas las huellas guardadas.
# AGE_VERIFICATION_REQUIRED=true hace obligatoria la verificación (desactivada
# por defecto). CSCA_PATHS: rutas separadas por comas con los CSCA de confianza.
fingerprint_key = System.get_env("DOCUMENT_FINGERPRINT_KEY", "") |> String.trim()

age_verification_required =
  case System.get_env("AGE_VERIFICATION_REQUIRED", "false") |> String.trim() do
    "true" -> true
    "false" -> false
    "" -> false
    other -> raise "AGE_VERIFICATION_REQUIRED must be true or false, got #{inspect(other)}"
  end

fingerprint_key =
  cond do
    fingerprint_key != "" -> fingerprint_key
    config_env() == :dev -> "__DEV_DOCUMENT_FINGERPRINT_KEY__"
    true -> nil
  end

if config_env() == :prod do
  cond do
    fingerprint_key != nil and
        (String.length(fingerprint_key) < 32 or
           String.downcase(fingerprint_key) in ["cambiar", "change", "changeme", "change_me"]) ->
      raise """
      environment variable DOCUMENT_FINGERPRINT_KEY is too weak (placeholder or
      shorter than 32 characters). Generate one with: mix phx.gen.secret
      """

    age_verification_required and fingerprint_key == nil ->
      raise """
      AGE_VERIFICATION_REQUIRED=true needs DOCUMENT_FINGERPRINT_KEY.
      Generate one with: mix phx.gen.secret (and never change it afterwards).
      """

    true ->
      :ok
  end
end

if config_env() != :test do
  config :snack, :age_verification, fingerprint_key: fingerprint_key
  config :snack, :features, age_verification_required: age_verification_required

  case split_csv_env.("CSCA_PATHS", nil) do
    [] -> :ok
    paths -> config :snack, Snack.Identity.Document.TrustStore, paths: paths
  end
end

if config_env() == :prod do
  access_token_salt =
    System.get_env("AUTH_ACCESS_TOKEN_SALT") ||
      raise """
      environment variable AUTH_ACCESS_TOKEN_SALT is missing.
      Generate one with: mix phx.gen.secret
      """

  refresh_token_salt =
    System.get_env("AUTH_REFRESH_TOKEN_SALT") ||
      raise """
      environment variable AUTH_REFRESH_TOKEN_SALT is missing.
      Generate one with: mix phx.gen.secret
      """

  config :snack, Snack.Auth,
    access_token_salt: access_token_salt,
    refresh_token_salt: refresh_token_salt
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :snack, Snack.Repo,
    ssl: System.get_env("DATABASE_SSL", "true") == "true",
    url: database_url,
    pool_size: positive_env.("POOL_SIZE", 10, 1000),
    queue_target: positive_env.("DB_QUEUE_TARGET_MS", 50, 60_000),
    queue_interval: positive_env.("DB_QUEUE_INTERVAL_MS", 1000, 60_000),
    timeout: positive_env.("DB_QUERY_TIMEOUT_MS", 15_000, 120_000),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  # Required (checked above): URLs and force_ssl redirects are built from it.
  host =
    System.get_env("PHX_HOST") ||
      raise "environment variable PHX_HOST is missing (e.g. api.snack.example)"

  config :snack, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :snack, SnackWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0}
    ],
    secret_key_base: secret_key_base

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :snack, SnackWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :snack, SnackWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
