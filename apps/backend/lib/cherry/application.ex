defmodule Cherry.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      CherryWeb.Telemetry,
      Cherry.Repo,
      {Oban, Application.fetch_env!(:cherry, Oban)},
      {Cherry.Identity.JwksCache,
       name: Cherry.Identity.Providers.GoogleJwksCache,
       jwks_url: "https://www.googleapis.com/oauth2/v3/certs",
       unavailable_error: :google_jwks_unavailable},
      {Cherry.Identity.JwksCache,
       name: Cherry.Identity.Providers.AppleJwksCache,
       jwks_url: "https://appleid.apple.com/auth/keys",
       unavailable_error: :apple_jwks_unavailable},
      Cherry.Identity.AppleBrowser,
      {DNSCluster, query: Application.get_env(:cherry, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Cherry.PubSub},
      # Periodic IDF tag-weight refresh for discovery (no-op under the test sandbox).
      Cherry.Dating.Discovery.TagWeights,
      # Marks expired matches (30 days without messages); reads already apply it lazily.
      Cherry.Dating.MatchExpirySweeper,
      # Physically deletes deleted photos and abandoned uploads (no-op under the test sandbox).
      Cherry.Dating.PhotoStorageSweeper,
      Cherry.Accounts.ErasureSweeper,
      # Start a worker by calling: Cherry.Worker.start_link(arg)
      # {Cherry.Worker, arg},
      # Start to serve requests, typically the last entry
      CherryWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Cherry.Supervisor]
    # Misconfigured sign-in must be loud at boot, not a silent 401 per login.
    Cherry.Auth.warn_missing_audiences()
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    CherryWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
