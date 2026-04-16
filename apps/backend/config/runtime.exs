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

config :snack, SnackWeb.Endpoint, http: [port: String.to_integer(System.get_env("PORT", "4000"))]

subscriptions_enabled? = System.get_env("ENABLE_SUBSCRIPTIONS") == "true"

config :snack,
  features: [
    subscriptions: subscriptions_enabled?
  ]

# Stripe runtime config.
#
# In prod with subscriptions enabled we refuse to boot without real keys —
# a missing env var should be a loud failure, not a silent fall-through to
# test credentials. In dev/test we keep harmless placeholders so local runs
# and the test suite work without extra setup.
stripe_fallbacks =
  if config_env() == :prod do
    %{api_key: nil, publishable_key: nil, webhook_secret: nil}
  else
    %{api_key: "sk_test_123", publishable_key: "pk_test_123", webhook_secret: "whsec_test_123"}
  end

fetch_stripe_env = fn var, fallback_key ->
  case System.get_env(var) do
    nil ->
      if config_env() == :prod and subscriptions_enabled? do
        raise """
        environment variable #{var} is missing.
        It is required when ENABLE_SUBSCRIPTIONS=true in production.
        """
      else
        Map.fetch!(stripe_fallbacks, fallback_key)
      end

    value ->
      value
  end
end

config :snack, :stripe,
  api_key: fetch_stripe_env.("STRIPE_SECRET_KEY", :api_key),
  base_url: System.get_env("STRIPE_BASE_URL", "https://api.stripe.com"),
  webhook_secret: fetch_stripe_env.("STRIPE_WEBHOOK_SECRET", :webhook_secret)

config :snack, :stripe_mobile,
  publishable_key: fetch_stripe_env.("STRIPE_PUBLISHABLE_KEY", :publishable_key),
  merchant_display_name: System.get_env("STRIPE_MERCHANT_DISPLAY_NAME", "Snack"),
  merchant_identifier: System.get_env("STRIPE_MERCHANT_IDENTIFIER"),
  url_scheme: System.get_env("STRIPE_URL_SCHEME", "snack")

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

  config :snack, Snack.Auth,
    providers: %{
      google: google_provider_config,
      apple: Snack.Identity.Providers.Apple
    }
end

config :snack, Snack.Identity.Providers.GoogleJwksCache,
  ttl_ms: String.to_integer(System.get_env("GOOGLE_JWKS_CACHE_TTL_MS", "600000"))

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
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
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

  host = System.get_env("PHX_HOST") || "example.com"

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
