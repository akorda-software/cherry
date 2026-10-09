defmodule Snack.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      SnackWeb.Telemetry,
      Snack.Repo,
      {Oban, Application.fetch_env!(:snack, Oban)},
      {Snack.Identity.JwksCache,
       name: Snack.Identity.Providers.GoogleJwksCache,
       jwks_url: "https://www.googleapis.com/oauth2/v3/certs",
       unavailable_error: :google_jwks_unavailable},
      {Snack.Identity.JwksCache,
       name: Snack.Identity.Providers.AppleJwksCache,
       jwks_url: "https://appleid.apple.com/auth/keys",
       unavailable_error: :apple_jwks_unavailable},
      {DNSCluster, query: Application.get_env(:snack, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Snack.PubSub},
      # Periodic IDF tag-weight refresh for discovery (no-op under the test sandbox).
      Snack.Dating.Discovery.TagWeights,
      # Marks expired matches (30 days without messages); reads already apply it lazily.
      Snack.Dating.MatchExpirySweeper,
      # Physically deletes deleted photos and abandoned uploads (no-op under the test sandbox).
      Snack.Dating.PhotoStorageSweeper,
      # Start a worker by calling: Snack.Worker.start_link(arg)
      # {Snack.Worker, arg},
      # Start to serve requests, typically the last entry
      SnackWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Snack.Supervisor]
    # Misconfigured sign-in must be loud at boot, not a silent 401 per login.
    Snack.Auth.warn_missing_audiences()
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    SnackWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
