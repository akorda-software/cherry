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

config :snack, Snack.Auth,
  access_token_ttl_seconds: 900,
  refresh_token_ttl_days: 30,
  access_token_salt: "snack-access-token",
  refresh_token_salt: "snack-refresh-token",
  providers: %{
    google: Snack.Identity.Providers.Google,
    apple: Snack.Identity.Providers.Apple
  }

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
