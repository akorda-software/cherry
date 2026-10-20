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
    plug(:private_media_cache)
    plug(CherryWeb.Plugs.Authenticate)
    plug(CherryWeb.Plugs.TrackActivity)
    plug(CherryWeb.Plugs.RequireLegalAcceptance)
  end

  defp private_media_cache(conn, _) do
    conn
    |> put_resp_header("cache-control", "private, no-store")
    |> put_resp_header("referrer-policy", "no-referrer")
  end

  # Social surfaces: with AGE_VERIFICATION_REQUIRED=true (off by default) they
  # need a verified age. Blocking and reporting stay outside on purpose.
  pipeline :age_verified do
    plug(CherryWeb.Plugs.RequireGoodStanding)
    plug(CherryWeb.Plugs.RequireAgeVerification)
  end

  pipeline :backoffice do
    plug(:accepts, ["html"])
    plug(:fetch_session)
    plug(:fetch_flash)
    plug(:put_secure_browser_headers)
    plug(CherryWeb.Plugs.BackofficeSession)
    plug(:protect_from_forgery)
  end

  scope "/backoffice", CherryWeb do
    pipe_through(:backoffice)
    get("/login", BackofficeController, :login)
    post("/login", BackofficeController, :create_session)
    get("/invitation", BackofficeController, :invitation)
    post("/invitation", BackofficeController, :accept_invitation)
    post("/logout", BackofficeController, :delete_session)
    get("/account", BackofficeAccountController, :show)
    post("/account", BackofficeAccountController, :update)
    post("/account/sessions", BackofficeAccountController, :revoke_sessions)
    get("/", BackofficeController, :dashboard)
    get("/cases", BackofficeController, :index)
    post("/cases/next", BackofficeController, :claim_next)
    get("/measures", BackofficeController, :measures)
    get("/team", BackofficeTeamController, :index)
    post("/team", BackofficeTeamController, :create)
    post("/team/:id", BackofficeTeamController, :update)
    post("/team/:id/reset-access", BackofficeTeamController, :reset_access)
    get("/activity", BackofficeTeamController, :activity)
    get("/cases/:id", BackofficeController, :show)
    post("/cases/:id/claim", BackofficeController, :claim)
    post("/cases/:id/reassign", BackofficeController, :reassign)
    post("/cases/:id/assign", BackofficeController, :assign)
    post("/cases/:id/release", BackofficeController, :release)
    post("/cases/:id/notes", BackofficeController, :add_note)
    post("/cases/:id/resolve", BackofficeController, :resolve)
  end

  scope "/", CherryWeb do
    pipe_through(:browser)

    get("/", PageController, :home)
    get("/contacto", PageController, :contact)
    get("/eliminar-cuenta", PageController, :deletion)

    for slug <-
          ~w(privacidad condiciones normas seguridad-infantil transparencia aviso-legal cookies) do
      get("/#{slug}", PageController, :legal, assigns: %{legal_slug: slug})
    end
  end

  scope "/", CherryWeb do
    get("/metrics", MetricsController, :show)
  end

  scope "/", CherryWeb do
    pipe_through(:api)

    get("/healthz", HealthController, :healthz)
    get("/readyz", HealthController, :readyz)
  end

  scope "/api", CherryWeb.Controllers.Api do
    # No browser-cookie session / browser CSRF: Apple form_post is authenticated
    # by one-use OAuth state; the app must prove possession again at redemption.
    post("/auth/apple/browser/callback", AppleBrowserController, :callback)
  end

  scope "/api", CherryWeb.Controllers.Api do
    pipe_through(:api)

    post("/auth/apple/browser", AppleBrowserController, :create)
    post("/auth/:provider/callback", AuthController, :create)
    post("/auth/dev/test-login", AuthController, :test_login)
    post("/session/refresh", SessionController, :refresh)
    delete("/session", SessionController, :delete)

    get("/config", ConfigController, :show)
  end

  # Local photo storage upload target: raw body, no Bearer (the signed token
  # issued by the upload intent authorises the write). See Cherry.Storage.Local.
  scope "/api", CherryWeb.Controllers.Api do
    put("/uploads/:token", UploadController, :create)
  end

  scope "/api", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/bootstrap", BootstrapController, :show)
    post("/photos/read-url", PhotoAccessController, :create)
  end

  scope "/api/me", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/legal", LegalController, :show)
    post("/legal", LegalController, :create)
    get("/auth-methods", AuthMethodController, :index)
    post("/auth-methods/:provider", AuthMethodController, :create)
    post("/auth-methods/:provider/unlink", AuthMethodController, :delete)
    get("/profile", ProfileController, :show)
    put("/profile", ProfileController, :update)
    post("/profile/complete", ProfileController, :complete)

    get("/discovery-preferences", DiscoveryPreferenceController, :show)
    put("/discovery-preferences", DiscoveryPreferenceController, :update)

    get("/photos", ProfilePhotoController, :index)
    post("/photos/upload-intent", ProfilePhotoController, :create_upload_intent)
    post("/photos/complete", ProfilePhotoController, :complete_upload)
    put("/photos/order", ProfilePhotoController, :reorder)
    delete("/photos/:id", ProfilePhotoController, :delete)

    get("/tags", ProfileTagController, :get_tags)
    put("/tags", ProfileTagController, :set_tags)

    get("/blocked-tags", ProfileTagController, :get_blocked_tags)
    put("/blocked-tags", ProfileTagController, :set_blocked_tags)

    post("/location", ProfileLocationController, :update)
    post("/push-token", PushTokenController, :create)

    post("/pause", SettingsController, :pause)
    post("/unpause", SettingsController, :unpause)
    delete("/account", SettingsController, :delete_account)

    get("/summary", ActivityController, :summary)

    get("/cases", CaseworkController, :index)
    post("/cases", CaseworkController, :create)
    get("/cases/:id", CaseworkController, :show)
    post("/cases/:id/appeal", CaseworkController, :appeal)
    get("/notices", CaseworkController, :notices)
    post("/notices/:id/read", CaseworkController, :read_notice)

    get("/verification", AgeVerificationController, :show)
    get("/verification/nfc/countries", AgeVerificationController, :nfc_countries)
    post("/verification/nfc", AgeVerificationController, :create_nfc)
    post("/verification/provider", AgeVerificationController, :create_provider)
    post("/verification/provider/check", AgeVerificationController, :check_provider)
  end

  scope "/api/discovery", CherryWeb.Controllers.Api do
    pipe_through([:authenticated_api, :age_verified])

    get("/feed", DiscoveryController, :feed)
    post("/actions", DiscoveryController, :create_action)
    post("/undo", DiscoveryController, :undo)
  end

  scope "/api/profiles", CherryWeb.Controllers.Api do
    pipe_through([:authenticated_api, :age_verified])

    get("/:id", PublicProfileController, :show)
  end

  scope "/api/likes", CherryWeb.Controllers.Api do
    pipe_through([:authenticated_api, :age_verified])

    get("/received", LikesController, :received)
  end

  scope "/api/tags", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    get("/", TagController, :index)
  end

  scope "/api/matches", CherryWeb.Controllers.Api do
    pipe_through([:authenticated_api, :age_verified])

    get("/", MatchController, :index)
    post("/:id/unmatch", MatchController, :unmatch)
  end

  scope "/api/conversations", CherryWeb.Controllers.Api do
    pipe_through([:authenticated_api, :age_verified])

    get("/", ChatController, :index)
    get("/:id/match", MatchController, :for_conversation)
    get("/:id/messages", ChatController, :messages)
    post("/:id/messages", ChatController, :create_message)
    post("/:id/read", ChatController, :read)
  end

  scope "/api/users/:profile_id", CherryWeb.Controllers.Api do
    pipe_through(:authenticated_api)

    post("/block", SafetyController, :block)
    post("/report", SafetyController, :report)
  end
end
