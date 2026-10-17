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
#     PHX_SERVER=true bin/cherry start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :cherry, CherryWeb.Endpoint, server: true
end

config :cherry, :app_version, System.get_env("APP_VERSION", "dev")

# Separate from end-user login; opt-in only after provisioning staff and testing HTTPS.
config :cherry, :backoffice_enabled, System.get_env("BACKOFFICE_ENABLED", "false") == "true"

config :cherry,
       :backoffice_trusted_proxy_ips,
       System.get_env("BACKOFFICE_TRUSTED_PROXY_IPS", "")
       |> String.split(",", trim: true)
       |> Enum.map(fn ip ->
         case :inet.parse_address(ip |> String.trim() |> String.to_charlist()) do
           {:ok, address} -> address
           _ -> raise "BACKOFFICE_TRUSTED_PROXY_IPS must contain exact IP addresses"
         end
       end)

config :cherry, :metrics_token, System.get_env("METRICS_TOKEN")

positive_env = fn name, default, maximum ->
  case Integer.parse(System.get_env(name, to_string(default))) do
    {value, ""} when value > 0 and value <= maximum -> value
    _ -> raise "#{name} must be an integer between 1 and #{maximum}"
  end
end

# Concurrency is per node. Keep HTTP and database capacity available when Expo
# slows down; increasing this requires measuring both its queue and the DB pool.
config :cherry, Oban, queues: [push: positive_env.("PUSH_CONCURRENCY", 4, 32)]

# The feed is an OLTP query. Its estimates can trigger tens of milliseconds of
# JIT compilation for a shorter execution; keep this scoped to our connections.
database_jit =
  case System.get_env("DB_JIT", "false") do
    "false" -> "off"
    "true" -> "on"
    _ -> raise "DB_JIT must be true or false"
  end

config :cherry, Cherry.Repo, parameters: [jit: database_jit]

# En dev, DATABASE_URL (shell o .env) tiene prioridad sobre config/dev.exs para
# poder apuntar al PostGIS del compose (localhost:5510) sin tocar código.
if config_env() == :dev do
  case System.get_env("DATABASE_URL") do
    url when is_binary(url) and url != "" -> config :cherry, Cherry.Repo, url: url
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

config :cherry, CherryWeb.Endpoint, http: [port: port]

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
    (e.g. api.cherry.example); STORAGE_ADAPTER is local or r2.
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

config :cherry, :cors_allowed_origins, cors_allowed_origins

if config_env() != :test do
  google_web_client_id = System.get_env("GOOGLE_WEB_CLIENT_ID")

  google_ios_client_id = System.get_env("GOOGLE_IOS_CLIENT_ID")

  google_audiences =
    [google_web_client_id, google_ios_client_id]
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(&(&1 == ""))

  google_provider_config = [
    module: Cherry.Identity.Providers.Google,
    audiences: google_audiences,
    issuers: ["https://accounts.google.com", "accounts.google.com"]
  ]

  apple_audiences =
    split_csv_env.(
      "APPLE_AUDIENCES",
      System.get_env("EXPO_IOS_BUNDLE_IDENTIFIER", "app.cherry.mobile")
    )

  apple_provider_config = [
    module: Cherry.Identity.Providers.Apple,
    audiences: apple_audiences,
    issuers: ["https://appleid.apple.com"]
  ]

  config :cherry, Cherry.Auth,
    providers: %{
      google: google_provider_config,
      apple: apple_provider_config
    }
end

config :cherry, Cherry.Identity.Providers.GoogleJwksCache,
  ttl_ms: String.to_integer(System.get_env("GOOGLE_JWKS_CACHE_TTL_MS", "600000"))

config :cherry, Cherry.Identity.Providers.AppleJwksCache,
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
      config :cherry, Cherry.Storage, adapter: Cherry.Storage.Local

    adapter when adapter in ["r2", "s3"] ->
      config :cherry, Cherry.Storage, adapter: Cherry.Storage.R2

    other ->
      raise "invalid STORAGE_ADAPTER #{inspect(other)}: expected local, r2 or s3"
  end

  cond do
    uploads_dir != "" ->
      config :cherry, Cherry.Storage.Local, uploads_dir: uploads_dir

    config_env() == :prod and storage_adapter == "local" ->
      raise """
      environment variable UPLOADS_DIR is required with STORAGE_ADAPTER=local.
      Point it to a persistent volume (e.g. /var/lib/cherry/uploads) and back it up.
      """

    true ->
      :ok
  end

  config :cherry, Cherry.Storage.Local,
    max_upload_bytes: String.to_integer(System.get_env("UPLOAD_MAX_BYTES", "2000000")),
    upload_url_ttl_seconds: String.to_integer(System.get_env("UPLOAD_URL_TTL_SECONDS", "600"))

  # Base absoluta de las URLs de medios relativas (almacenamiento local), p. ej.
  # https://api.cherry.example. Sin definir ⇒ se usa el host de cada petición,
  # que el cliente controla (cabecera Host): en prod con `local` es obligatoria.
  if config_env() == :prod and storage_adapter == "local" do
    case URI.parse(public_base_url) do
      %URI{scheme: scheme, host: host}
      when scheme in ["http", "https"] and host not in [nil, ""] ->
        :ok

      _invalid ->
        raise """
        environment variable PUBLIC_BASE_URL is required with STORAGE_ADAPTER=local.
        Set it to the public origin of the API (e.g. https://api.cherry.example):
        upload and photo URLs are built from it instead of the request Host header.
        """
    end
  end

  if public_base_url != "", do: config(:cherry, :public_base_url, public_base_url)
end

s3_endpoint = System.get_env("S3_ENDPOINT", "") |> String.trim()

if System.get_env("ERASURE_JOURNAL_ENABLED", "false") == "true" do
  for name <-
        ~w(ERASURE_JOURNAL_ENDPOINT ERASURE_JOURNAL_BUCKET ERASURE_JOURNAL_ACCESS_KEY_ID ERASURE_JOURNAL_SECRET_ACCESS_KEY) do
    if String.trim(System.get_env(name, "")) == "",
      do: raise("missing required recovery journal setting: #{name}")
  end
end

config :cherry, Cherry.Recovery.Journal,
  enabled: System.get_env("ERASURE_JOURNAL_ENABLED", "false") == "true",
  endpoint: System.get_env("ERASURE_JOURNAL_ENDPOINT"),
  bucket: System.get_env("ERASURE_JOURNAL_BUCKET"),
  access_key_id: System.get_env("ERASURE_JOURNAL_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("ERASURE_JOURNAL_SECRET_ACCESS_KEY")

config :cherry, Cherry.Storage.R2,
  account_id: System.get_env("R2_ACCOUNT_ID"),
  # Endpoint S3 genérico (MinIO, Garage...). Vacío ⇒ R2 (<account_id>.r2.cloudflarestorage.com).
  endpoint: if(s3_endpoint != "", do: s3_endpoint),
  region: System.get_env("S3_REGION") || if(s3_endpoint != "", do: "us-east-1"),
  access_key_id: System.get_env("R2_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("R2_SECRET_ACCESS_KEY"),
  bucket_name: System.get_env("R2_BUCKET_NAME"),
  public_url_base: System.get_env("R2_PUBLIC_URL_BASE"),
  read_url_ttl_seconds: 300,
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

config :cherry, :expo_push,
  base_url: System.get_env("EXPO_PUSH_BASE_URL", "https://exp.host"),
  access_token: System.get_env("EXPO_PUSH_ACCESS_TOKEN"),
  receive_timeout_ms: positive_env.("EXPO_PUSH_RECEIVE_TIMEOUT_MS", 5000, 15_000),
  batch_size: positive_env.("EXPO_PUSH_BATCH_SIZE", 100, 100),
  pool_timeout_ms: positive_env.("EXPO_PUSH_POOL_TIMEOUT_MS", 5000, 15_000),
  connect_timeout_ms: positive_env.("EXPO_PUSH_CONNECT_TIMEOUT_MS", 5000, 15_000)

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

config :cherry, :message_cipher, key: message_cipher_key

optional_env = fn name ->
  case System.get_env(name, "") |> String.trim() do
    "" -> nil
    value -> value
  end
end

# ── Instance identity (one Cherry per country) ─────────────────────────
# Public data served by GET /api/config so one app build can show who runs the
# instance it talks to. Defaults keep the Spanish instance; operator, contact
# and legal URLs have none (each instance states its own, see TRADEMARKS.md).
http_url_env = fn name ->
  case optional_env.(name) do
    nil ->
      nil

    value ->
      case URI.parse(value) do
        %URI{scheme: scheme, host: host}
        when scheme in ["http", "https"] and host not in [nil, ""] ->
          value

        _invalid ->
          raise "#{name} must be an http(s) URL, got #{inspect(value)}"
      end
  end
end

instance_country = (optional_env.("INSTANCE_COUNTRY") || "ES") |> String.upcase()

unless Regex.match?(~r/\A[A-Z]{2}\z/, instance_country) do
  raise "INSTANCE_COUNTRY must be an ISO 3166-1 alpha-2 code (e.g. ES, FR), got #{inspect(instance_country)}"
end

instance_locale = optional_env.("INSTANCE_LOCALE") || "es-ES"

unless Regex.match?(~r/\A[a-z]{2,3}(-[A-Z]{2})?\z/, instance_locale) do
  raise "INSTANCE_LOCALE must be a language tag such as es-ES or fr-FR, got #{inspect(instance_locale)}"
end

instance_contact_email = optional_env.("INSTANCE_CONTACT_EMAIL")

if instance_contact_email &&
     not Regex.match?(~r/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/, instance_contact_email) do
  raise "INSTANCE_CONTACT_EMAIL must be an email address, got #{inspect(instance_contact_email)}"
end

config :cherry, :instance,
  name: optional_env.("INSTANCE_NAME") || "Cherry",
  country: instance_country,
  locale: instance_locale,
  operator: optional_env.("INSTANCE_OPERATOR"),
  contact_email: instance_contact_email,
  privacy_url: http_url_env.("INSTANCE_PRIVACY_URL"),
  terms_url: http_url_env.("INSTANCE_TERMS_URL"),
  source_url: http_url_env.("INSTANCE_SOURCE_URL")

# These are public details, not secrets. Each operator supplies their own.
config :cherry, :public_legal,
  address: optional_env.("PUBLIC_LEGAL_ADDRESS"),
  tax_id: optional_env.("PUBLIC_TAX_ID"),
  registry: optional_env.("PUBLIC_REGISTRY"),
  approved: System.get_env("LEGAL_TEXTS_APPROVED", "false") == "true"

# Enable only after approval, distribution of the consent-capable mobile client
# and notice to existing accounts. It is not a declaration of legal compliance.
config :cherry,
       :legal_enforcement_enabled,
       System.get_env("LEGAL_ENFORCEMENT_ENABLED", "false") == "true"

# ── Verificación de edad (D-2026-10-09) ────────────────────────────────
# DOCUMENT_FINGERPRINT_KEY: clave HMAC de la huella del documento (una persona,
# una cuenta). Sin ella, POST /api/me/verification/nfc responde 503. No se puede
# rotar: cambiarla deja huérfanas todas las huellas guardadas.
# AGE_VERIFICATION_REQUIRED=true hace obligatoria la verificación (desactivada
# por defecto). CSCA_PATHS: rutas separadas por comas con los CSCA de confianza.
# CSCA_COUNTRIES: country folders of the bundled priv/csca to trust (e.g. es).
# AGE_VERIFICATION_MINIMUM_AGE (18): also the minimum age of a profile.
# AGE_VERIFICATION_DOCUMENTS: id_card and/or passport (both by default).
minimum_age =
  case Integer.parse(optional_env.("AGE_VERIFICATION_MINIMUM_AGE") || "18") do
    {age, ""} when age in 18..99 -> age
    _invalid -> raise "AGE_VERIFICATION_MINIMUM_AGE must be an integer between 18 and 99"
  end

accepted_documents =
  case split_csv_env.("AGE_VERIFICATION_DOCUMENTS", "id_card,passport") do
    [] ->
      raise "AGE_VERIFICATION_DOCUMENTS must list id_card and/or passport"

    documents ->
      Enum.map(documents, fn
        "id_card" ->
          :id_card

        "passport" ->
          :passport

        other ->
          raise "invalid AGE_VERIFICATION_DOCUMENTS entry #{inspect(other)}: expected id_card or passport"
      end)
      |> Enum.uniq()
  end

csca_countries =
  case split_csv_env.("CSCA_COUNTRIES", nil) do
    [] ->
      nil

    countries ->
      countries = Enum.map(countries, &String.downcase/1)

      Enum.each(countries, fn country ->
        unless Regex.match?(~r/\A[a-z]{2}\z/, country) do
          raise "invalid CSCA_COUNTRIES entry #{inspect(country)}: expected a folder of priv/csca such as es"
        end
      end)

      countries
  end

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

# DIDIT_API_KEY y DIDIT_WORKFLOW_ID: verificación con selfie y documento (Didit).
# Sin ellas, POST /api/me/verification/provider responde 503. DIDIT_WEBHOOK_SECRET
# aún no se usa (en dev se consulta la decisión; producción necesitará el webhook
# para las sesiones «In Review»).
if config_env() != :test do
  config :cherry, :age_verification,
    fingerprint_key: fingerprint_key,
    minimum_age: minimum_age,
    accepted_documents: accepted_documents

  config :cherry, :didit,
    api_key: optional_env.("DIDIT_API_KEY"),
    workflow_id: optional_env.("DIDIT_WORKFLOW_ID")

  config :cherry, :features, age_verification_required: age_verification_required

  case split_csv_env.("CSCA_PATHS", nil) do
    [] -> :ok
    paths -> config :cherry, Cherry.Identity.Document.TrustStore, paths: paths
  end

  if csca_countries do
    config :cherry, Cherry.Identity.Document.TrustStore, countries: csca_countries
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

  config :cherry, Cherry.Auth,
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

  config :cherry, Cherry.Repo,
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
      raise "environment variable PHX_HOST is missing (e.g. api.cherry.example)"

  config :cherry, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  # Public URL of the API. Behind Cloudflare/Caddy it is https on 443; for a
  # first deploy reachable only over the LAN, PHX_URL_SCHEME=http (and
  # FORCE_SSL=false, below).
  url_scheme =
    case System.get_env("PHX_URL_SCHEME", "https") |> String.trim() |> String.downcase() do
      scheme when scheme in ["http", "https"] ->
        scheme

      other ->
        raise "environment variable PHX_URL_SCHEME must be http or https, got: #{inspect(other)}"
    end

  url_port =
    case Integer.parse(System.get_env("PHX_URL_PORT", "") |> String.trim()) do
      {port, ""} when port in 1..65_535 -> port
      _ -> if(url_scheme == "https", do: 443, else: 80)
    end

  # HTTPS redirect + HSTS (CherryWeb.Plugs.ForceSSL). On unless FORCE_SSL=false:
  # only for trying the API over plain HTTP on a private network.
  force_ssl =
    case System.get_env("FORCE_SSL", "true") |> String.trim() |> String.downcase() do
      value when value in ["false", "0", "no"] ->
        false

      _ ->
        [rewrite_on: [:x_forwarded_proto], hsts: true, exclude: ["localhost", "127.0.0.1"]]
    end

  config :cherry, :force_ssl, force_ssl

  config :cherry, CherryWeb.Endpoint,
    url: [host: host, port: url_port, scheme: url_scheme],
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
  #     config :cherry, CherryWeb.Endpoint,
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
  #     config :cherry, CherryWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end
