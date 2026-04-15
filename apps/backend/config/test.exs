import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :snack, Snack.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "snack_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :snack, SnackWeb.Endpoint,
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

config :snack, Snack.Auth,
  access_token_ttl_seconds: 900,
  refresh_token_ttl_days: 30,
  access_token_salt: "snack-access-token-test",
  refresh_token_salt: "snack-refresh-token-test",
  providers: %{
    google: Snack.Identity.Providers.Google,
    apple: Snack.Identity.Providers.Apple
  }
