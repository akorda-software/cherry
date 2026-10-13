import Config

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
#
# BD de tests: TEST_DATABASE_URL si está definida; si no, DATABASE_URL solo si
# su base de datos es de tests (el nombre contiene `_test`, p. ej. cherry_test o
# cherry_test_fix). Así un DATABASE_URL de dev exportado en la shell nunca hace
# que `mix test` machaque cherry_dev. Sin ninguna, localhost:5432/cherry_test.
test_database_url =
  case {System.get_env("TEST_DATABASE_URL"), System.get_env("DATABASE_URL")} do
    {url, _} when is_binary(url) and url != "" ->
      url

    {_, url} when is_binary(url) and url != "" ->
      database =
        url |> URI.parse() |> Map.get(:path, "") |> to_string() |> String.trim_leading("/")

      if String.contains?(database, "_test") do
        url
      else
        raise """
        refusing to run tests against DATABASE_URL database #{inspect(database)}:
        its name must contain "_test" (tests wipe their database). Use
        TEST_DATABASE_URL=ecto://postgres:postgres@localhost:5510/cherry_test mix test
        """
      end

    _none ->
      nil
  end

if test_database_url do
  config :cherry, Cherry.Repo,
    url: test_database_url,
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

# Persist jobs in the sandbox; tests decide when to execute them.
config :cherry, Oban, testing: :manual

# Photo storage: R2 by default (its tests stub the HTTP layer); local-storage
# tests switch the adapter and use their own temporary directories.
config :cherry, Cherry.Storage, adapter: Cherry.Storage.R2

config :cherry, Cherry.Storage.Local,
  uploads_dir: Path.expand("../tmp/test_uploads#{System.get_env("MIX_TEST_PARTITION")}", __DIR__)

# Age verification: a fixed key; tests pass their own synthetic CSCAs.
config :cherry, :age_verification,
  fingerprint_key: "test-document-fingerprint-key-0123456789",
  minimum_age: 18,
  attempt_limits: [{5, 3600}, {10, 86_400}]

# Didit (provider age verification): fake credentials; tests stub the HTTP
# layer with Req.Test (no network).
config :cherry, :didit,
  api_key: "test-didit-api-key",
  workflow_id: "test-didit-workflow",
  base_url: "https://didit.test",
  allow_sandbox: true,
  req_options: [plug: {Req.Test, Cherry.Identity.Didit}]
