defmodule CherryWeb.Router do
  use CherryWeb, :router

  pipeline :browser do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_live_flash)
    plug(:put_root_layout, html: {CherryWeb.Layouts, :root})
    plug(:protect_from_forgery)
    plug(:put_secure_browser_headers)
  end

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :authenticated_api do
    plug(:accepts, ["json"])
    plug(CherryWeb.Plugs.Authenticate)
  end

  scope "/", CherryWeb do
    pipe_through(:browser)

    get("/", PageController, :home)
  end

  scope "/", CherryWeb do
    pipe_through(:api)

    get("/healthz", HealthController, :healthz)
    get("/readyz", HealthController, :readyz)
  end

  scope "/api", CherryWeb.Controllers.Api do
    pipe_through(:api)

    post("/auth/:provider/callback", AuthController, :create)
    post("/auth/dev/test-login", AuthController, :test_login)
    post("/session/refresh", SessionController, :refresh)
    delete("/session", SessionController, :delete)

    get("/config", ConfigController, :show)
  end

  scope "/api", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/bootstrap", BootstrapController, :show)
  end

  scope "/api/me", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/profile", ProfileController, :show)
    put("/profile", ProfileController, :update)
    post("/profile/complete", ProfileController, :complete)

    get("/discovery-preferences", ProfileController, :show_discovery_preferences)
    put("/discovery-preferences", ProfileController, :update_discovery_preferences)

    get("/photos", ProfileController, :list_photos)
    post("/photos/upload-intent", ProfileController, :create_photo_upload_intent)
    post("/photos/complete", ProfileController, :complete_photo_upload)
    delete("/photos/:id", ProfileController, :delete_photo)

    get("/tags", ProfileController, :get_tags)
    put("/tags", ProfileController, :set_tags)

    get("/blocked-tags", ProfileController, :get_blocked_tags)
    put("/blocked-tags", ProfileController, :set_blocked_tags)

    post("/location", ProfileController, :update_location)
    post("/push-token", PushTokenController, :create)

    post("/pause", SettingsController, :pause)
    post("/unpause", SettingsController, :unpause)
    delete("/account", SettingsController, :delete_account)
  end

  scope "/api/discovery", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/feed", DiscoveryController, :feed)
    post("/actions", DiscoveryController, :create_action)
  end

  scope "/api/tags", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/", TagController, :index)
  end

  scope "/api/matches", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/", MatchController, :index)
    post("/:id/unmatch", MatchController, :unmatch)
  end

  scope "/api/conversations", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/", ChatController, :index)
    get("/:id/messages", ChatController, :messages)
    post("/:id/messages", ChatController, :create_message)
  end

  scope "/api/users/:profile_id", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    post("/block", SafetyController, :block)
    post("/report", SafetyController, :report)
  end
end
