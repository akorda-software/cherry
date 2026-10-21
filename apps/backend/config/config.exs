# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :cherry,
  ecto_repos: [Cherry.Repo],
  generators: [timestamp_type: :utc_datetime]

# Serialize index migrations across release replicas without wrapping concurrent
# index creation in a transaction or taking an exclusive table lock.
config :cherry, Cherry.Repo,
  migration_lock: :pg_advisory_lock,
  types: Cherry.PostgresTypes

config :cherry, Cherry.Auth,
  access_token_ttl_seconds: 900,
  refresh_token_ttl_days: 30,
  access_token_salt: "cherry-access-token",
  refresh_token_salt: "cherry-refresh-token",
  providers: %{
    google: Cherry.Identity.Providers.Google,
    apple: Cherry.Identity.Providers.Apple
  }

# Photo storage (D-2026-09-29). The adapter is chosen per environment:
# dev → local disk, test → R2 (tests stub it), prod → STORAGE_ADAPTER (required).
config :cherry, Cherry.Storage, adapter: nil

config :cherry, Cherry.Storage.Local,
  uploads_dir: nil,
  allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
  max_upload_bytes: 2_000_000,
  upload_url_ttl_seconds: 600

config :cherry, Cherry.Storage.R2,
  account_id: nil,
  endpoint: nil,
  region: nil,
  access_key_id: nil,
  secret_access_key: nil,
  bucket_name: nil,
  public_url_base: nil,
  allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
  max_upload_bytes: 2_000_000,
  upload_url_ttl_seconds: 600

# Absolute base for media URLs stored as relative paths (local storage). Unset ⇒
# the host of each request is used (runtime env PUBLIC_BASE_URL).
config :cherry, :public_base_url, nil

# Identity of this instance (one Cherry per country, see TRADEMARKS.md). Public:
# served by GET /api/config. Runtime env INSTANCE_* (config/runtime.exs); the
# defaults keep the behaviour of the Spanish instance. operator/contact/legal
# URLs have no default: each instance must state who runs it.
config :cherry, :instance,
  name: "Cherry",
  country: "ES",
  locale: "es-ES",
  operator: nil,
  contact_email: nil,
  privacy_url: nil,
  terms_url: nil,
  source_url: nil

# Age verification (D-2026-10-09, docs/compliance/02-mayoria-de-edad.md).
# fingerprint_key: DOCUMENT_FINGERPRINT_KEY (runtime). Without it the NFC
# verification endpoint answers 503. minimum_age (AGE_VERIFICATION_MINIMUM_AGE)
# also applies to the birth date of a profile. accepted_documents
# (AGE_VERIFICATION_DOCUMENTS): :id_card (identity cards and residence
# permits) and/or :passport. Attempt limits: {max, window in seconds}.
config :cherry, :age_verification,
  fingerprint_key: nil,
  minimum_age: 18,
  accepted_documents: [:id_card, :passport],
  attempt_limits: [{5, 3600}, {10, 86_400}]

# External age verification method: selfie + document with Didit
# (Cherry.Identity.Didit). api_key/workflow_id: DIDIT_API_KEY and
# DIDIT_WORKFLOW_ID (runtime); without them POST /api/me/verification/provider
# answers 503. webhook_secret: DIDIT_WEBHOOK_SECRET, the secret of the webhook
# destination (POST /api/webhooks/didit answers 503 without it). allow_sandbox:
# accept decisions of Didit's sandbox (made-up documents); only dev and test.
config :cherry, :didit,
  api_key: nil,
  workflow_id: nil,
  webhook_secret: nil,
  base_url: "https://verification.didit.me",
  allow_sandbox: false

# Trusted CSCA certificates for passive authentication. `paths` defaults to the
# release's priv/csca (every country of the public master lists, see its
# README); CSCA_PATHS replaces it and CSCA_COUNTRIES
# picks country folders of priv/csca at runtime (see TrustStore).
config :cherry, Cherry.Identity.Document.TrustStore, certificates: []

# A match without messages expires after this many days (D-2026-09-29).
config :cherry, :match_expiry_days, 30

config :cherry, :expo_push,
  base_url: "https://exp.host",
  access_token: nil,
  receive_timeout_ms: 5_000

config :cherry, Oban,
  repo: Cherry.Repo,
  queues: [push: 4, verification: 2],
  plugins: [
    {Oban.Plugins.Pruner, max_age: 86_400},
    {Oban.Plugins.Lifeline, rescue_after: :timer.minutes(5)}
  ]

# Configure the endpoint
config :cherry, CherryWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: CherryWeb.ErrorHTML, json: CherryWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Cherry.PubSub,
  live_view: [signing_salt: "/5NL+uU4"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Never log identity documents (age verification) nor credentials. Keys that
# contain any of these strings are replaced by [FILTERED] in request logs.
config :phoenix, :filter_parameters, [
  "password",
  "dg1",
  "dg2",
  "sod",
  "can",
  "mrz",
  "code",
  "token",
  "nonce",
  "state",
  "verifier",
  "credential",
  # Phoenix filtering is case-sensitive; mobile JSON uses camelCase keys.
  "Credential",
  "Token",
  "Code",
  "Challenge",
  "challenge",
  # Apple's first form_post can include an opaque JSON `user` profile string.
  "user",
  "statement",
  "response",
  "details",
  # Internal backoffice notes on a case.
  "note"
]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
