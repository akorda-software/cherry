import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
#
# Si DATABASE_URL está definido (p. ej. cuando localhost:5432 está ocupado por
# otro proyecto, ver ~/dev/projects/PUERTOS.md), se usa tal cual.
if System.get_env("DATABASE_URL") do
  config :cherry, Cherry.Repo,
    url: System.get_env("DATABASE_URL"),
    pool: Ecto.Adapters.SQL.Sandbox,
    pool_size: System.schedulers_online() * 2,
    types: Cherry.PostgresTypes
else
  config :cherry, Cherry.Repo,
    username: "postgres",
    password: "postgres",
    hostname: "localhost",
    database: "cherry_test#{System.get_env("MIX_TEST_PARTITION")}",
    pool: Ecto.Adapters.SQL.Sandbox,
    pool_size: System.schedulers_online() * 2,
    types: Cherry.PostgresTypes
end

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :cherry, CherryWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "iUXnk0MZ+AMaKjraKMrpODJyZGEP9Pr4ytmm5cIhq4uNKZ1PjHdtWUHbii8tfgwk",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Sort query params output of verified routes for robust url comparisons
config :phoenix,
  sort_verified_routes_query_params: true

config :cherry, Cherry.Auth,
  access_token_ttl_seconds: 900,
  refresh_token_ttl_days: 30,
  access_token_salt: "cherry-access-token-test",
  refresh_token_salt: "cherry-refresh-token-test",
  providers: %{
    google: Cherry.Identity.Providers.Google,
    apple: Cherry.Identity.Providers.Apple
  }

config :cherry, :expo_push_client, Cherry.Notifications.MockExpoClient
