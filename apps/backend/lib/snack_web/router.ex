defmodule SnackWeb.Router do
  use SnackWeb, :router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_live_flash)
    plug(:put_root_layout, html: {SnackWeb.Layouts, :root})
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :authenticated_api do
    plug(:accepts, ["json"])
    plug(SnackWeb.Plugs.Authenticate)
  end

  pipeline :require_subscriptions do
    plug(SnackWeb.Plugs.RequireFeature, :subscriptions)
  end

  pipeline :stripe_webhook do
    plug(:accepts, ["json"])
    plug(SnackWeb.Plugs.RequireFeature, :subscriptions)
    plug(SnackWeb.Plugs.VerifyStripeSignature)
  end

  scope "/", SnackWeb do
    pipe_through(:browser)

    get("/", PageController, :home)
  end

  scope "/api", SnackWeb.Controllers.Api do
    pipe_through(:api)

    post("/auth/:provider/callback", AuthController, :create)
    post("/session/refresh", SessionController, :refresh)
    delete("/session", SessionController, :delete)

    get("/config", ConfigController, :show)
  end

  scope "/api/billing", SnackWeb.Controllers.Api do
    pipe_through([:authenticated_api, :require_subscriptions])

    get("/plans", BillingController, :plans)
    post("/subscribe", BillingController, :subscribe)
    post("/cancel", BillingController, :cancel)
    post("/abandon-pending", BillingController, :abandon_pending)
    get("/subscription", BillingController, :subscription)
  end

  scope "/api/webhooks", SnackWeb.Controllers.Api do
    pipe_through([:stripe_webhook])

    post("/stripe", WebhookController, :stripe)
  end
end
