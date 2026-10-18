defmodule Cherry.AuthMethodsTest do
  use CherryWeb.ConnCase, async: false
  alias Cherry.{Accounts, Identity, Repo, Sessions}
  alias Cherry.Identity.{AppleCodeExchange, AuthMethods, ProviderIdentity}
  alias Cherry.TestSupport.ProviderTokenFactory, as: Tokens

  setup do
    tokens = Tokens.configure!()
    before = Application.get_env(:cherry, :apple_browser)
    journal = Application.get_env(:cherry, Cherry.Recovery.Journal)
    Application.put_env(:cherry, Cherry.Recovery.Journal, enabled: false)

    Application.put_env(:cherry, :apple_browser,
      enabled: true,
      client_id: "app.cherry.browser",
      team_id: "TEAM123456",
      key_id: "KEY1234567",
      private_key: :public_key.generate_key({:namedCurve, :secp256r1}),
      req_options: [plug: {Req.Test, AppleCodeExchange}]
    )

    Req.Test.stub(AppleCodeExchange, fn conn ->
      {:ok, body, conn} = Plug.Conn.read_body(conn)
      form = URI.decode_query(body)

      case conn.request_path do
        "/auth/token" ->
          Req.Test.json(conn, %{
            "id_token" => Process.get({:apple_code, form["code"]}),
            "refresh_token" => "synthetic-refresh-" <> form["code"]
          })

        "/auth/revoke" ->
          send(self(), :apple_revoked)
          Plug.Conn.send_resp(conn, Process.get(:revocation_status, 200), "")
      end
    end)

    on_exit(fn ->
      Tokens.restore!(tokens)
      Application.put_env(:cherry, :apple_browser, before || [])
      Application.put_env(:cherry, Cherry.Recovery.Journal, journal || [])
    end)

    google = google(tokens)

    {:ok, %{user: user}} =
      Identity.resolve_provider_login(:google, %{provider_token: google["providerToken"]})

    {:ok, issued} = Sessions.issue_session(user, device())
    %{tokens: tokens, user: user, session: issued, google: google}
  end

  defp device,
    do: %{installation_id: "auth-methods-test", platform: "android", device_name: "Synthetic"}

  defp google(tokens, overrides \\ %{}),
    do: %{"providerToken" => Tokens.google_token!(tokens.google_key, overrides)}

  defp apple(tokens, overrides \\ %{}) do
    nonce = Ecto.UUID.generate()
    code = Ecto.UUID.generate()
    token = Tokens.apple_token!(tokens.apple_key, nonce, overrides)
    Process.put({:apple_code, code}, token)
    %{"providerToken" => token, "idToken" => token, "nonce" => nonce, "authorizationCode" => code}
  end

  defp link_params(ctx, overrides \\ %{}),
    do:
      Map.merge(
        %{
          "currentProvider" => "google",
          "currentCredential" => ctx.google,
          "credential" => apple(ctx.tokens, %{"email" => ctx.user.email})
        },
        overrides
      )

  defp link(ctx),
    do: AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :apple, link_params(ctx))

  defp auth_conn(ctx),
    do:
      %{build_conn() | scheme: :https}
      |> put_req_header("authorization", "Bearer " <> ctx.session.session.access_token)

  test "authenticated listing exposes only provider and unlink capability", ctx do
    conn = get(auth_conn(ctx), "https://cherry.example/api/me/auth-methods")

    assert json_response(conn, 200) == %{
             "methods" => [%{"provider" => "google", "canUnlink" => false}]
           }

    assert get_resp_header(conn, "cache-control") == ["private, no-store"]
    assert get(build_conn(), "/api/me/auth-methods").status == 401
    conn = %{auth_conn(ctx) | scheme: :http} |> put_req_header("x-forwarded-proto", "https")
    assert get(conn, "/api/me/auth-methods").status == 426
  end

  test "both proof objects are redacted and JSON proof bodies are not retained", ctx do
    params = %{
      "currentProvider" => "google",
      "currentCredential" => %{"providerToken" => "synthetic-current"},
      "credential" => %{
        "providerToken" => "synthetic-added",
        "authorizationCode" => "synthetic-code"
      }
    }

    filtered = Phoenix.Logger.filter_values(params)
    assert filtered["currentCredential"] == "[FILTERED]"
    assert filtered["credential"] == "[FILTERED]"

    for key <- ~w(providerToken idToken authorizationCode) do
      assert Phoenix.Logger.filter_values(%{key => "synthetic"})[key] == "[FILTERED]"
    end

    conn =
      auth_conn(ctx)
      |> put_req_header("content-type", "application/json")
      |> post("https://cherry.example/api/me/auth-methods/apple", Jason.encode!(params))

    assert conn.status == 422
    refute Map.has_key?(conn.private, :raw_body)
  end

  test "two fresh proofs link the same email to one stable account; either provider can log in",
       ctx do
    assert {:ok, %{methods: methods}} = link(ctx)
    assert Enum.sort(Enum.map(methods, & &1.provider)) == ["apple", "google"]
    assert Enum.all?(methods, & &1.canUnlink)
    assert Repo.aggregate(Accounts.User, :count) == 1

    assert {:ok, %{user: google_user}} =
             Identity.resolve_provider_login(:google, %{
               provider_token: ctx.google["providerToken"]
             })

    proof = apple(ctx.tokens, %{"email" => ctx.user.email})

    assert {:ok, %{user: apple_user}} =
             Identity.resolve_provider_login(:apple, %{
               provider_token: proof["providerToken"],
               id_token: proof["idToken"],
               nonce: proof["nonce"],
               authorization_code: proof["authorizationCode"]
             })

    assert apple_user.id == ctx.user.id and google_user.id == ctx.user.id
    assert apple_user.email == ctx.user.email
    assert {:ok, _} = link(ctx)
    assert Repo.aggregate(ProviderIdentity, :count) == 2
  end

  test "Apple hidden email links without changing the contact email", ctx do
    params =
      link_params(ctx, %{
        "credential" => apple(ctx.tokens, %{"email" => "synthetic@privaterelay.appleid.com"})
      })

    assert {:ok, _} = AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :apple, params)
    assert Repo.get!(Accounts.User, ctx.user.id).email == ctx.user.email
  end

  test "a bearer alone or another identity with the same email is not ownership proof", ctx do
    for proof <- [
          nil,
          %{},
          google(ctx.tokens, %{"sub" => "unrelated-google-person", "email" => ctx.user.email})
        ] do
      params = link_params(ctx, %{"currentCredential" => proof})

      assert {:error, :reauthentication_required} =
               AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :apple, params)
    end

    assert Repo.aggregate(ProviderIdentity, :count) == 1
  end

  test "freshness is checked on both proofs, including missing and future issued-at", ctx do
    for time <- [nil, System.os_time(:second) - 301, System.os_time(:second) + 60] do
      params = link_params(ctx, %{"currentCredential" => google(ctx.tokens, %{"iat" => time})})

      assert {:error, :reauthentication_required} =
               AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :apple, params)

      params = link_params(ctx, %{"credential" => apple(ctx.tokens, %{"iat" => time})})

      assert {:error, :reauthentication_required} =
               AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :apple, params)
    end

    assert Repo.aggregate(ProviderIdentity, :count) == 1
  end

  test "cannot take a provider identity already owned by another account", ctx do
    other = apple(ctx.tokens)

    assert {:ok, %{user: other_user}} =
             Identity.resolve_provider_login(:apple, %{
               provider_token: other["providerToken"],
               id_token: other["idToken"],
               nonce: other["nonce"],
               authorization_code: other["authorizationCode"]
             })

    assert {:error, :identity_in_use} =
             AuthMethods.link(
               ctx.user.id,
               ctx.session.session_family.id,
               :apple,
               link_params(ctx)
             )

    assert Repo.get_by!(ProviderIdentity, provider: "apple").user_id == other_user.id
    assert Repo.aggregate(Accounts.User, :count) == 2
  end

  test "cannot replace an existing provider with another identity", ctx do
    params = %{
      "currentProvider" => "google",
      "currentCredential" => ctx.google,
      "credential" => google(ctx.tokens, %{"sub" => "replacement-google"})
    }

    assert {:error, :provider_already_linked} =
             AuthMethods.link(ctx.user.id, ctx.session.session_family.id, :google, params)

    assert Repo.get_by!(ProviderIdentity, provider: "google").provider_subject ==
             "google-user-123"
  end

  test "revoked, foreign or missing sessions cannot mutate identities", ctx do
    assert {:error, :session_revoked} =
             AuthMethods.link(ctx.user.id, Ecto.UUID.generate(), :apple, link_params(ctx))

    Sessions.revoke_user_sessions(ctx.user.id)
    assert {:error, :session_revoked} = link(ctx)
    assert Repo.aggregate(ProviderIdentity, :count) == 1
  end

  test "cannot remove the last method or prove removal using the method being removed", ctx do
    assert {:error, :reauth_with_remaining_method} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :google, %{
               "currentProvider" => "google",
               "currentCredential" => ctx.google
             })

    identity = Repo.get_by!(ProviderIdentity, provider: "google")
    assert {:error, :identity_erasure_pending} = AuthMethods.erase_for_recovery(identity.id)
    assert Repo.get(ProviderIdentity, identity.id)
  end

  test "unlink Apple confirms revocation, keeps account/current session, revokes other sessions",
       ctx do
    CherryWeb.Endpoint.subscribe("user_socket:#{ctx.user.id}")
    assert {:ok, _} = link(ctx)
    {:ok, other} = Sessions.issue_session(ctx.user, device())

    assert {:ok, %{methods: [%{provider: "google", canUnlink: false}]}} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :apple, %{
               "currentProvider" => "google",
               "currentCredential" => ctx.google
             })

    assert_received :apple_revoked
    assert_receive %Phoenix.Socket.Broadcast{event: "disconnect"}
    assert Sessions.active_session_family?(ctx.session.session_family.id, ctx.user.id)
    refute Sessions.active_session_family?(other.session_family.id, ctx.user.id)
    assert Repo.get!(Accounts.User, ctx.user.id).email == ctx.user.email
    assert Repo.aggregate(Cherry.Accounts.ErasureTask, :count) == 0
  end

  test "Apple outage does not falsely confirm unlink or create a stale revocation outbox", ctx do
    assert {:ok, _} = link(ctx)
    Process.put(:revocation_status, 503)

    assert {:error, :apple_revocation_pending} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :apple, %{
               "currentProvider" => "google",
               "currentCredential" => ctx.google
             })

    assert Repo.get_by(ProviderIdentity, provider: "apple")
    assert Repo.aggregate(Cherry.Accounts.ErasureTask, :count) == 0
    Process.put(:revocation_status, 200)

    assert {:ok, _} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :apple, %{
               "currentProvider" => "google",
               "currentCredential" => ctx.google
             })
  end

  test "journal outage blocks unlink before revocation or association removal", ctx do
    assert {:ok, _} = link(ctx)

    Application.put_env(:cherry, Cherry.Recovery.Journal,
      enabled: true,
      endpoint: "https://journal.test",
      bucket: "ledger",
      access_key_id: "synthetic",
      secret_access_key: "synthetic",
      request_options: [plug: {Req.Test, Cherry.Recovery.Journal}]
    )

    Req.Test.stub(Cherry.Recovery.Journal, fn conn -> Plug.Conn.send_resp(conn, 503, "") end)

    assert {:error, :erasure_protection_unavailable} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :apple, %{
               "currentProvider" => "google",
               "currentCredential" => ctx.google
             })

    refute_received :apple_revoked
    assert Repo.get_by(ProviderIdentity, provider: "apple")
  end

  test "unlink Google preserves the freshly proven Apple credential and either cleanup covers all linked identities",
       ctx do
    assert {:ok, _} = link(ctx)

    assert {:ok, %{methods: [%{provider: "apple"}]}} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :google, %{
               "currentProvider" => "apple",
               "currentCredential" => apple(ctx.tokens)
             })

    assert map_size(Repo.get_by!(ProviderIdentity, provider: "apple").apple_revocation) == 1
    assert {:ok, :deleted} = Accounts.delete_account(ctx.user)
    assert_received :apple_revoked
    assert Repo.aggregate(ProviderIdentity, :count) == 0
    refute Repo.get(Accounts.User, ctx.user.id)
  end

  test "recovery tombstone deletes only its identity UUID, never a later relink", ctx do
    assert {:ok, _} = link(ctx)
    old = Repo.get_by!(ProviderIdentity, provider: "apple")
    assert :ok = AuthMethods.erase_for_recovery(old.id)
    assert_received :apple_revoked
    refute Repo.get(ProviderIdentity, old.id)
    # Recovery closed every old session; obtain a new one before explicitly relinking.
    {:ok, issued} = Sessions.issue_session(ctx.user, device())
    ctx = %{ctx | session: issued}
    assert {:ok, _} = link(ctx)
    fresh = Repo.get_by!(ProviderIdentity, provider: "apple")
    refute fresh.id == old.id
    assert :ok = AuthMethods.erase_for_recovery(old.id)
    assert Repo.get(ProviderIdentity, fresh.id)
  end

  test "account deletion removes both linked identities and revokes Apple without retaining the user",
       ctx do
    assert {:ok, _} = link(ctx)
    assert Repo.aggregate(ProviderIdentity, :count) == 2
    assert {:ok, :deleted} = Accounts.delete_account(ctx.user)
    assert_received :apple_revoked
    assert Repo.aggregate(ProviderIdentity, :count) == 0
    assert Repo.aggregate(Accounts.User, :count) == 0
    assert Repo.aggregate(Cherry.Accounts.ErasureTask, :count) == 0
  end

  test "a login verified before unlink cannot issue a session after unlink commits", ctx do
    assert {:ok, _} = link(ctx)

    assert {:ok, %{identity: old_identity}} =
             Identity.resolve_provider_login(
               :google,
               %{provider_token: ctx.google["providerToken"]}
             )

    assert {:ok, _} =
             AuthMethods.unlink(ctx.user.id, ctx.session.session_family.id, :google, %{
               "currentProvider" => "apple",
               "currentCredential" => apple(ctx.tokens)
             })

    assert {:error, :identity_unlinked} =
             Sessions.issue_session(ctx.user, device(), old_identity.id)
  end

  test "HTTP proof failures are 422 (not bearer refresh/replay), conflicts are 409", ctx do
    conn = post(auth_conn(ctx), "https://cherry.example/api/me/auth-methods/apple", %{})
    assert json_response(conn, 422) == %{"error" => "reauthentication_required"}

    assert json_response(
             post(
               auth_conn(ctx),
               "https://cherry.example/api/me/auth-methods/apple",
               link_params(ctx)
             ),
             200
           )

    assert get_resp_header(conn, "referrer-policy") == ["no-referrer"]

    conn =
      post(auth_conn(ctx), "https://cherry.example/api/me/auth-methods/google", %{
        "currentProvider" => "google",
        "currentCredential" => ctx.google,
        "credential" => google(ctx.tokens, %{"sub" => "replacement"})
      })

    assert json_response(conn, 409) == %{"error" => "provider_already_linked"}
  end
end
