import Config

# HTTPS redirect and HSTS: CherryWeb.Plugs.ForceSSL, configured at runtime from
# FORCE_SSL in config/runtime.exs (on by default in prod).

# Do not print debug messages in production
config :logger, level: :info

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
