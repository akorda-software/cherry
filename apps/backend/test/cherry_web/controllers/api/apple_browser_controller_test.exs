defmodule CherryWeb.Controllers.Api.AppleBrowserControllerTest do
  use CherryWeb.ConnCase, async: false
  alias Cherry.Identity.{AppleBrowser, AppleCodeExchange, Providers.Apple}
  alias Cherry.TestSupport.ProviderTokenFactory, as: Tokens
  alias Cherry.{Accounts.User, Repo}

  @client "app.cherry.browser"
  @return_url "https://cherry.example/api/auth/apple/browser/callback"
  @verifier String.duplicate("v", 64)
  @nonce "synthetic-browser-nonce"
  @client_state String.duplicate("b", 64)

  setup do
    keys = [:apple_browser, :backoffice_host, :backoffice_trusted_proxy_ips, :force_ssl]
    before = Map.new(keys, &{&1, Application.get_env(:cherry, &1)})
    tokens = Tokens.configure!()
    clock = start_supervised!({Agent, fn -> 1_000 end})

    server =
      start_supervised!(
        {AppleBrowser, name: __MODULE__.Cache, clock: fn -> Agent.get(clock, & &1) end}
      )

    config = [
      enabled: true,
      client_id: @client,
      redirect_uri: @return_url,
      app_redirect_uris: ["cherry://auth/apple"],
      team_id: "TEAM123456",
      key_id: "KEY1234567",
      private_key: :public_key.generate_key({:namedCurve, :secp256r1}),
      req_options: [plug: {Req.Test, AppleCodeExchange}],
      server: server
    ]

    Application.put_env(:cherry, :apple_browser, config)
    Application.put_env(:cherry, :force_ssl, false)
    Application.delete_env(:cherry, :backoffice_host)
    Application.put_env(:cherry, :backoffice_trusted_proxy_ips, [])

    on_exit(fn ->
      Tokens.restore!(tokens)

      for {key, value} <- before do
        if is_nil(value),
          do: Application.delete_env(:cherry, key),
          else: Application.put_env(:cherry, key, value)
      end
    end)

    %{tokens: tokens, clock: clock, server: server, config: config}
  end

  defp request_params(overrides \\ %{}) do
    Map.merge(
      %{
        "codeChallenge" => :crypto.hash(:sha256, @verifier) |> Base.url_encode64(padding: false),
        "nonce" => :crypto.hash(:sha256, @nonce) |> Base.encode16(case: :lower),
        "state" => @client_state,
        "redirectUri" => "cherry://auth/apple"
      },
      overrides
    )
  end

  defp start_flow do
    conn = post(build_conn(), "https://cherry.example/api/auth/apple/browser", request_params())
    %{"authorizationUrl" => url} = json_response(conn, 200)
    query = URI.parse(url).query |> URI.decode_query()
    {query["state"], query, conn}
  end

  defp stub_token(tokens, overrides \\ %{}) do
    token =
      Tokens.apple_token!(tokens.apple_key, @nonce, Map.merge(%{"aud" => @client}, overrides))

    Req.Test.stub(AppleCodeExchange, fn conn ->
      assert conn.host == "appleid.apple.com" and conn.request_path == "/auth/token"
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      form = URI.decode_query(body)
      assert form["grant_type"] == "authorization_code"
      assert form["client_id"] == @client
      assert form["redirect_uri"] == @return_url
      assert form["client_secret"] != ""

      Req.Test.json(conn, %{
        "id_token" => token,
        "access_token" => "synthetic-discarded-access",
        "refresh_token" => "synthetic-discarded-refresh"
      })
    end)

    token
  end

  defp finish(state, overrides \\ %{}) do
    conn =
      post(
        build_conn(),
        @return_url,
        Map.merge(%{"state" => state, "code" => "synthetic-apple-code"}, overrides)
      )

    assert response(conn, 302) == ""
    [location] = get_resp_header(conn, "location")
    {URI.parse(location).query |> URI.decode_query(), conn, location}
  end

  test "starts code flow with exact HTTPS callback, nonce and server state, without cookies" do
    {state, query, conn} = start_flow()
    assert byte_size(state) == 43 and state != @client_state
    assert query["response_type"] == "code"
    assert query["response_mode"] == "form_post"
    assert query["scope"] == "email"
    assert query["client_id"] == @client
    assert query["redirect_uri"] == @return_url
    assert query["nonce"] == request_params()["nonce"]
    assert conn.resp_cookies == %{}
    assert get_resp_header(conn, "cache-control") == ["private, no-store, no-transform"]
    refute Map.has_key?(conn.private, :raw_body)
  end

  test "request logs filter browser proofs and Apple's first-login user payload" do
    params =
      Map.merge(request_params(), %{
        "code" => "synthetic-apple-code",
        "id_token" => "synthetic-identity-token",
        "user" => ~s({"email":"synthetic@example.invalid"})
      })

    filtered = Phoenix.Logger.filter_values(params)

    for key <- ~w(codeChallenge nonce state code id_token user) do
      assert filtered[key] == "[FILTERED]"
    end
  end

  test "backend-only code exchange creates no user until one-use mobile proof", %{
    tokens: tokens,
    server: server
  } do
    token = stub_token(tokens)
    {state, _, _} = start_flow()
    {result, conn, location} = finish(state)
    assert result["state"] == @client_state
    assert byte_size(result["code"]) == 43
    assert Repo.aggregate(User, :count) == 0
    assert conn.resp_cookies == %{}
    refute Map.has_key?(conn.private, :raw_body)
    refute location =~ token
    refute location =~ "synthetic-apple-code"
    refute inspect(:sys.get_state(server)) =~ "synthetic-discarded"

    payload = %{
      providerToken: "apple-browser:" <> result["code"],
      nonce: @verifier,
      device: %{
        installationId: "browser-test",
        platform: "android",
        deviceName: "Synthetic Android"
      }
    }

    signed = post(build_conn(), "https://cherry.example/api/auth/apple/callback", payload)
    assert %{"accessToken" => access, "refreshToken" => refresh} = json_response(signed, 201)
    assert access != "" and refresh != ""
    assert get_resp_header(signed, "cache-control") == ["private, no-store"]
    assert Repo.aggregate(User, :count) == 1
    identity = Repo.one!(Cherry.Identity.ProviderIdentity)
    assert Map.has_key?(identity.apple_revocation, @client)
    refute Jason.encode!(identity.apple_revocation) =~ "synthetic-discarded-refresh"
    refute Jason.encode!(identity.provider_data) =~ "refresh_token"

    assert post(build_conn(), "https://cherry.example/api/auth/apple/callback", payload)
           |> json_response(401)

    assert post(build_conn(), @return_url, %{"state" => state, "code" => "replay"})
           |> response(400)
  end

  test "accepts Apple's real form content type without browser cookies or CSRF", %{tokens: tokens} do
    stub_token(tokens)
    {state, _, _} = start_flow()

    conn =
      build_conn()
      |> put_req_header("content-type", "application/x-www-form-urlencoded")
      |> put_req_header("accept", "text/html")
      |> post(@return_url, URI.encode_query(%{"state" => state, "code" => "synthetic-form-code"}))

    assert response(conn, 302) == ""
    assert conn.resp_cookies == %{}
    refute Map.has_key?(conn.private, :raw_body)
    [location] = get_resp_header(conn, "location")
    assert URI.parse(location).query |> URI.decode_query() |> Map.has_key?("code")
    assert Repo.aggregate(User, :count) == 0
  end

  test "wrong verifier cannot consume a grant; concurrent correct redemption succeeds once", %{
    tokens: tokens
  } do
    stub_token(tokens)
    {state, _, _} = start_flow()
    {result, _, _} = finish(state)
    grant = result["code"]

    assert {:error, :invalid_provider_token} =
             AppleBrowser.redeem(grant, String.duplicate("x", 64))

    results =
      1..5
      |> Task.async_stream(fn _ -> AppleBrowser.redeem(grant, @verifier) end)
      |> Enum.to_list()

    assert Enum.count(results, &match?({:ok, {:ok, _}}, &1)) == 1
    assert Enum.count(results, &match?({:ok, {:error, :invalid_provider_token}}, &1)) == 4
  end

  test "state expiry, grant expiry and unsolicited callbacks fail closed", %{
    tokens: tokens,
    clock: clock
  } do
    assert post(build_conn(), @return_url, %{"state" => String.duplicate("x", 43), "code" => "x"})
           |> response(400)

    stub_token(tokens)
    {state, _, _} = start_flow()
    Agent.update(clock, &(&1 + 300_001))

    assert {:error, :invalid_apple_browser_state} =
             AppleBrowser.complete(%{"state" => state, "code" => "x"})

    {state, _, _} = start_flow()
    {result, _, _} = finish(state)
    Agent.update(clock, &(&1 + 60_001))
    assert {:error, :invalid_provider_token} = AppleBrowser.redeem(result["code"], @verifier)
  end

  test "signed tokens with wrong nonce, audience, issuer, expiry or signature never issue handoff",
       %{tokens: tokens} do
    for overrides <- [
          %{"nonce" => "wrong"},
          %{"sub" => nil},
          %{"email" => nil},
          %{"aud" => "cherry-apple-service-id"},
          %{"iss" => "https://evil.example"},
          %{"exp" => System.os_time(:second) - 120}
        ] do
      stub_token(tokens, overrides)
      {state, _, _} = start_flow()
      {result, _, _} = finish(state)
      assert result == %{"error" => "apple_sign_in_failed", "state" => @client_state}
    end

    invalid_token =
      Tokens.apple_token!(Tokens.generate_signing_key("untrusted"), @nonce, %{"aud" => @client})

    Req.Test.stub(AppleCodeExchange, &Req.Test.json(&1, %{"id_token" => invalid_token}))
    {state, _, _} = start_flow()
    assert {%{"error" => "apple_sign_in_failed"}, _, _} = finish(state)
    assert Repo.aggregate(User, :count) == 0
  end

  test "browser Services ID cannot be used as a native audience", %{tokens: tokens} do
    token = stub_token(tokens)
    assert {:error, :invalid_audience} = Apple.verify(%{provider_token: token, nonce: @nonce})
  end

  test "provider cancellation and exchange failures return only a fixed error to an allowed app" do
    {state, _, _} = start_flow()

    {result, _, location} =
      finish(state, %{"error" => "access_denied", "error_description" => "never-reflect-this"})

    assert result["error"] == "apple_sign_in_failed"
    refute location =~ "never-reflect-this"

    Req.Test.stub(AppleCodeExchange, fn conn ->
      conn |> Plug.Conn.put_status(400) |> Req.Test.json(%{"error" => "secret-provider-error"})
    end)

    {state, _, _} = start_flow()
    {result, _, location} = finish(state)
    assert result["error"] == "apple_sign_in_failed"
    refute location =~ "secret-provider-error"
  end

  test "arbitrary redirects and malformed proofs rejected before authorization" do
    for overrides <- [
          %{"redirectUri" => "https://evil.example"},
          %{"redirectUri" => "cherry://auth/apple?evil=yes"},
          %{"redirectUri" => "cherry://auth/apple.evil"},
          %{"codeChallenge" => "short"},
          %{"nonce" => "bad"},
          %{"state" => "bad"}
        ] do
      assert post(
               build_conn(),
               "https://cherry.example/api/auth/apple/browser",
               request_params(overrides)
             )
             |> json_response(422)
    end
  end

  test "callback host, HTTP and forged forwarding headers cannot bypass transport" do
    assert post(build_conn(), "http://cherry.example/api/auth/apple/browser", request_params())
           |> response(426)

    assert build_conn()
           |> put_req_header("x-forwarded-proto", "https")
           |> post("http://cherry.example/api/auth/apple/browser", request_params())
           |> response(426)

    {state, _, _} = start_flow()

    assert post(build_conn(), "https://evil.example/api/auth/apple/browser/callback", %{
             "state" => state
           })
           |> response(400)

    # Wrong-host request did not consume the state.
    assert {%{"error" => "apple_sign_in_failed"}, _, _} =
             finish(state, %{"error" => "access_denied"})
  end

  test "disabled flow is absent and cannot redeem issued grants", %{
    config: config,
    tokens: tokens
  } do
    stub_token(tokens)
    {state, _, _} = start_flow()
    {result, _, _} = finish(state)
    Application.put_env(:cherry, :apple_browser, Keyword.put(config, :enabled, false))

    assert post(build_conn(), "https://cherry.example/api/auth/apple/browser", request_params())
           |> response(404)

    assert post(build_conn(), @return_url, %{}) |> response(404)

    assert {:error, :invalid_provider_token} =
             AppleBrowser.redeem(result["code"], @verifier)
  end

  test "starts are throttled and both rate/state maps are bounded" do
    for _ <- 1..30, do: assert({:ok, _} = AppleBrowser.start(request_params(), {127, 0, 0, 1}))

    assert {:error, :apple_browser_rate_limited} =
             AppleBrowser.start(request_params(), {127, 0, 0, 1})

    for n <- 1..482,
        do: assert({:ok, _} = AppleBrowser.start(request_params(), {:synthetic_peer, n}))

    assert {:error, :apple_browser_rate_limited} =
             AppleBrowser.start(request_params(), {:synthetic_peer, 900})
  end

  test "client secret uses ES256 JOSE signature and expires after five minutes", %{config: config} do
    assert {:ok, jwt} = AppleCodeExchange.client_secret(config)
    [header, claims, signature] = String.split(jwt, ".")

    assert %{"alg" => "ES256", "kid" => "KEY1234567"} =
             header |> Base.url_decode64!(padding: false) |> Jason.decode!()

    payload = claims |> Base.url_decode64!(padding: false) |> Jason.decode!()
    assert payload["iss"] == config[:team_id] and payload["sub"] == @client
    assert payload["aud"] == "https://appleid.apple.com"
    assert payload["exp"] - payload["iat"] == 300

    <<r::unsigned-big-integer-size(256), s::unsigned-big-integer-size(256)>> =
      Base.url_decode64!(signature, padding: false)

    der = :public_key.der_encode(:"ECDSA-Sig-Value", {:"ECDSA-Sig-Value", r, s})
    key = config[:private_key]

    assert :public_key.verify(
             header <> "." <> claims,
             :sha256,
             der,
             {{:ECPoint, elem(key, 4)}, elem(key, 3)}
           )
  end

  test "same email from another provider never silently merges accounts", %{tokens: tokens} do
    google = Tokens.google_token!(tokens.google_key)
    assert {:ok, _} = Cherry.Identity.resolve_provider_login(:google, %{provider_token: google})
    stub_token(tokens, %{"email" => "google@example.test"})
    # Use the authenticated Google account's email without depending on fixture text.
    user = Repo.one!(User)
    stub_token(tokens, %{"email" => user.email})
    {state, _, _} = start_flow()
    {result, _, _} = finish(state)

    conn =
      post(build_conn(), "https://cherry.example/api/auth/apple/callback", %{
        providerToken: "apple-browser:" <> result["code"],
        nonce: @verifier
      })

    assert json_response(conn, 409) == %{"error" => "identity_conflict"}
    assert Repo.aggregate(User, :count) == 1
  end
end
