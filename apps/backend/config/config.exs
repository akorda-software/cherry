# This file is responsible for configuring your application
# and its dependencies with the aid of the Config module.
#
# This configuration file is loaded before any dependency and
# is restricted to this project.

# General application configuration
import Config

config :snack,
  ecto_repos: [Snack.Repo],
  generators: [timestamp_type: :utc_datetime]

# Serialize index migrations across release replicas without wrapping concurrent
# index creation in a transaction or taking an exclusive table lock.
config :snack, Snack.Repo,
  migration_lock: :pg_advisory_lock,
  types: Snack.PostgresTypes

config :snack, Snack.Auth,
  access_token_ttl_seconds: 900,
  refresh_token_ttl_days: 30,
  access_token_salt: "snack-access-token",
  refresh_token_salt: "snack-refresh-token",
  providers: %{
    google: Snack.Identity.Providers.Google,
    apple: Snack.Identity.Providers.Apple
  }

# Photo storage (D-2026-09-29). The adapter is chosen per environment:
# dev → local disk, test → R2 (tests stub it), prod → STORAGE_ADAPTER (required).
config :snack, Snack.Storage, adapter: nil

config :snack, Snack.Storage.Local,
  uploads_dir: nil,
  allowed_content_types: ["image/jpeg", "image/png", "image/webp"],
  max_upload_bytes: 2_000_000,
  upload_url_ttl_seconds: 600

config :snack, Snack.Storage.R2,
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
config :snack, :public_base_url, nil

# A match without messages expires after this many days (D-2026-09-29).
config :snack, :match_expiry_days, 30

config :snack, :expo_push,
  base_url: "https://exp.host",
  access_token: nil,
  receive_timeout_ms: 5_000

config :snack, Oban,
  repo: Snack.Repo,
  queues: [push: 4],
  plugins: [
    {Oban.Plugins.Pruner, max_age: 86_400},
    {Oban.Plugins.Lifeline, rescue_after: :timer.minutes(5)}
  ]

# Configure the endpoint
config :snack, SnackWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [html: SnackWeb.ErrorHTML, json: SnackWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Snack.PubSub,
  live_view: [signing_salt: "/5NL+uU4"]

# Configure Elixir's Logger
config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Use Jason for JSON parsing in Phoenix
config :phoenix, :json_library, Jason

# Import environment specific config. This must remain at the bottom
# of this file so it overrides the configuration defined above.
import_config "#{config_env()}.exs"
