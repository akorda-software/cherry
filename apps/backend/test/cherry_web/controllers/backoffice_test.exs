defmodule CherryWeb.BackofficeTest do
  use CherryWeb.ConnCase, async: false
  import Cherry.TestSupport.DatingFixtures
  alias Cherry.Backoffice.Access
  alias Cherry.Casework
  alias Cherry.Casework.Case
  alias Cherry.Dating
  alias Cherry.Repo

  setup do
    before = Application.get_env(:cherry, :backoffice_enabled)
    Application.put_env(:cherry, :backoffice_enabled, true)

    on_exit(fn ->
      if is_nil(before),
        do: Application.delete_env(:cherry, :backoffice_enabled),
        else: Application.put_env(:cherry, :backoffice_enabled, before)
    end)

    {:ok, staff} =
      Access.provision("staff#{System.unique_integer([:positive])}@example.test", "admin")

    %{staff: staff, conn: %{build_conn() | scheme: :https}}
  end

  test "disabled by default; no staff content for anonymous or app bearer sessions", %{conn: conn} do
    Application.put_env(:cherry, :backoffice_enabled, false)
    assert conn |> https_get("/backoffice/login") |> response(404)

    assert conn
           |> put_private(:plug_skip_csrf_protection, false)
           |> https_post("/backoffice/login", %{})
           |> response(404)

    Application.put_env(:cherry, :backoffice_enabled, true)
    assert conn |> https_get("/backoffice") |> redirected_to() == "/backoffice/login"
    user = user_fixture()

    assert authed_conn_for_user(user)
           |> Map.put(:scheme, :https)
           |> https_get("/backoffice")
           |> redirected_to() ==
             "/backoffice/login"

    assert conn |> https_get("/backoffice/cases/bad-id") |> redirected_to() == "/backoffice/login"
  end

  test "login, security headers, secured cookie, logout and revoked cookie", %{
    conn: conn,
    staff: staff
  } do
    {:ok, code} = Access.issue_login(staff.email)
    conn = https_post(conn, "/backoffice/login", %{"code" => code})
    assert redirected_to(conn) == "/backoffice"
    cookie = conn.resp_cookies["_cherry_backoffice"]
    assert cookie.http_only and cookie.secure
    assert cookie.same_site == "Strict"
    assert cookie.path == "/backoffice"
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    assert get_resp_header(conn, "referrer-policy") == ["no-referrer"]
    assert get_resp_header(conn, "x-robots-tag") == ["noindex, nofollow"]
    refute Map.has_key?(conn.private, :raw_body)
    saved = recycle(conn)
    assert conn |> https_get("/backoffice") |> html_response(200) =~ "Expedientes"
    assert saved |> https_post("/backoffice/logout") |> redirected_to() == "/backoffice/login"
    assert saved |> https_get("/backoffice") |> redirected_to() == "/backoffice/login"
  end

  test "login and resolution reject missing CSRF when protection is enabled", %{
    conn: conn,
    staff: staff
  } do
    {:ok, code} = Access.issue_login(staff.email)

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      conn
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/login", %{"code" => code})
    end

    assert {:ok, _} = Access.exchange(code)
  end

  test "forms work with a genuine CSRF token and cannot reuse code", %{conn: conn, staff: staff} do
    {:ok, code} = Access.issue_login(staff.email)
    conn = https_get(conn, "/backoffice/login")
    html = html_response(conn, 200)
    [_, csrf] = Regex.run(~r/name="_csrf_token"[^>]*value="([^"]+)"/, html)

    conn =
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/login", %{"code" => code, "_csrf_token" => csrf})

    assert redirected_to(conn) == "/backoffice"

    assert build_conn()
           |> Map.put(:scheme, :https)
           |> https_post("/backoffice/login", %{"code" => code})
           |> html_response(401) =~
             "Código inválido"
  end

  test "private queue, escaped case view, assignment and resolution", %{conn: conn, staff: staff} do
    reporter = user_fixture()
    target = user_fixture()
    a = complete_profile_fixture(reporter)
    b = complete_profile_fixture(target)
    {:ok, report} = Dating.Safety.report(a, b.id, "harassment", "<script>alert(1)</script>")
    record = Repo.get_by!(Case, report_id: report.id)
    {:ok, code} = Access.issue_login(staff.email)
    conn = https_post(conn, "/backoffice/login", %{"code" => code})
    assert conn |> https_get("/backoffice") |> html_response(200) =~ String.slice(record.id, 0, 8)
    page = conn |> https_get("/backoffice/cases/#{record.id}") |> html_response(200)
    assert page =~ "&lt;script&gt;"
    refute page =~ "<script>alert"
    refute page =~ reporter.email

    assert conn |> https_post("/backoffice/cases/#{record.id}/claim") |> redirected_to() ==
             "/backoffice/cases/#{record.id}"

    assert conn |> https_get("/backoffice/cases/#{record.id}") |> html_response(200) =~
             "Guardar decisión"

    assert conn
           |> https_post("/backoffice/cases/#{record.id}/resolve", %{
             "outcome" => "warning",
             "response" => "Explicación suficiente sin datos de terceros.",
             "reporter_response" => "Hemos actuado sobre este reporte de forma proporcionada."
           })
           |> redirected_to() == "/backoffice/cases/#{record.id}"

    assert conn |> https_get("/backoffice/cases/#{record.id}") |> html_response(200) =~
             "Advertencia"

    assert length(Casework.notices(target)) == 1
  end

  test "HTTP and forged forwarding headers fail closed" do
    assert build_conn() |> get("/backoffice/login") |> response(426)

    assert build_conn()
           |> put_req_header("x-forwarded-proto", "https")
           |> get("/backoffice/login")
           |> response(426)

    before = Application.get_env(:cherry, :backoffice_trusted_proxy_ips, [])
    Application.put_env(:cherry, :backoffice_trusted_proxy_ips, [{127, 0, 0, 1}])
    on_exit(fn -> Application.put_env(:cherry, :backoffice_trusted_proxy_ips, before) end)

    assert build_conn()
           |> Map.put(:remote_ip, {127, 0, 0, 1})
           |> put_req_header("x-forwarded-proto", "https")
           |> get("/backoffice/login")
           |> html_response(200) =~ "Código de un solo uso"

    assert build_conn()
           |> Map.put(:remote_ip, {10, 1, 1, 1})
           |> put_req_header("x-forwarded-proto", "https")
           |> get("/backoffice/login")
           |> response(426)
  end

  test "authenticated mutations still require CSRF and invalid reasons preserve the draft", %{
    conn: conn,
    staff: staff
  } do
    requester = user_fixture()

    {:ok, record} =
      Casework.submit(requester, %{
        "kind" => "complaint",
        "category" => "service",
        "statement" => "Necesito que el equipo revise esta incidencia."
      })

    {:ok, code} = Access.issue_login(staff.email)
    conn = https_post(conn, "/backoffice/login", %{"code" => code})

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/cases/#{record.id}/claim")
    end

    assert Repo.get!(Case, record.id).assigned_staff_id == nil
    {:ok, _} = Casework.claim(staff, record.id)

    html =
      conn
      |> https_post("/backoffice/cases/#{record.id}/resolve", %{
        "outcome" => "answered",
        "response" => "<b>short</b>"
      })
      |> html_response(422)

    assert html =~ "&lt;b&gt;short&lt;/b&gt;"
    assert Repo.get!(Case, record.id).status == "open"
  end

  defp https_get(conn, path), do: get(conn, "https://www.example.com" <> path)

  test "only the superuser sees and manages the team; invites activate independent logins", %{
    conn: conn,
    staff: admin
  } do
    {:ok, code} = Access.issue_login(admin.email)
    admin_conn = https_post(conn, "/backoffice/login", %{"code" => code})
    assert admin_conn |> https_get("/backoffice/team") |> response(403)

    assert admin_conn
           |> https_post("/backoffice/team", %{
             "email" => "forbidden@example.test",
             "role" => "superadmin"
           })
           |> response(403)

    {:ok, owner} = Access.provision("owner@example.test", "superadmin")
    {:ok, code} = Access.issue_login(owner.email)
    owner_conn = https_post(build_conn(), "/backoffice/login", %{"code" => code})

    assert owner_conn |> https_get("/backoffice/team") |> html_response(200) =~
             "Equipo y permisos"

    page =
      owner_conn
      |> https_post("/backoffice/team", %{"email" => "helper@example.test", "role" => "moderator"})
      |> html_response(200)

    assert page =~ "No se ha enviado ningún correo"
    [_, invitation] = Regex.run(~r/<pre[^>]*>([^<]+)<\/pre>/, page)
    password = "synthetic-web-test-passphrase"

    activated =
      https_post(build_conn(), "/backoffice/invitation", %{
        "code" => String.trim(invitation),
        "password" => password
      })

    assert redirected_to(activated) == "/backoffice"
    assert activated |> https_get("/backoffice/team") |> response(403)

    logged_in =
      https_post(build_conn(), "/backoffice/login", %{
        "method" => "password",
        "email" => "helper@example.test",
        "password" => password
      })

    assert redirected_to(logged_in) == "/backoffice"
    helper = Repo.get_by!(Cherry.Backoffice.Staff, email: "helper@example.test")

    assert owner_conn
           |> https_post("/backoffice/team/#{helper.id}", %{
             "role" => "privacy",
             "disabled" => "false"
           })
           |> redirected_to() == "/backoffice/team"

    assert logged_in |> https_get("/backoffice") |> redirected_to() == "/backoffice/login"
    refute page =~ password

    assert owner_conn
           |> https_post("/backoffice/team/#{owner.id}", %{"disabled" => "true"})
           |> html_response(409) =~ "al menos un superusuario"
  end

  test "team and invitation mutations enforce genuine CSRF before any change", %{conn: conn} do
    {:ok, owner} = Access.provision("csrf-owner@example.test", "superadmin")
    {:ok, code} = Access.issue_login(owner.email)
    owner_conn = https_post(conn, "/backoffice/login", %{"code" => code})

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      owner_conn
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/team", %{
        "email" => "csrf-target@example.test",
        "role" => "admin"
      })
    end

    refute Repo.get_by(Cherry.Backoffice.Staff, email: "csrf-target@example.test")

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      build_conn()
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/invitation", %{
        "code" => String.duplicate("x", 43),
        "password" => "synthetic-csrf-passphrase"
      })
    end
  end

  test "global FORCE_SSL rewriting cannot bypass the backoffice peer allowlist" do
    previous = Application.get_env(:cherry, :force_ssl, false)
    Application.put_env(:cherry, :force_ssl, rewrite_on: [:x_forwarded_proto])
    on_exit(fn -> Application.put_env(:cherry, :force_ssl, previous) end)

    assert build_conn()
           |> put_req_header("x-forwarded-proto", "https")
           |> get("/backoffice/login")
           |> response(426)
  end

  test "temporary owner must rotate before cases/team, with CSRF and session revocation", %{
    conn: conn
  } do
    {:ok, owner} =
      Cherry.Backoffice.Security.bootstrap(
        "bootstrap-web@example.invalid",
        "synthetic-temporary-web-passphrase"
      )

    signed =
      https_post(conn, "/backoffice/login", %{
        "method" => "password",
        "email" => owner.email,
        "password" => "synthetic-temporary-web-passphrase"
      })

    assert signed |> https_get("/backoffice") |> redirected_to() == "/backoffice/account"
    assert signed |> https_get("/backoffice/team") |> redirected_to() == "/backoffice/account"

    assert signed |> https_get("/backoffice/account") |> html_response(200) =~
             "contraseña temporal"

    assert_raise Plug.CSRFProtection.InvalidCSRFTokenError, fn ->
      signed
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> https_post("/backoffice/account", %{
        "current_password" => "synthetic-temporary-web-passphrase",
        "password" => "synthetic-personal-web-passphrase"
      })
    end

    assert signed
           |> https_post("/backoffice/account", %{
             "current_password" => "wrong",
             "password" => "synthetic-personal-web-passphrase"
           })
           |> response(422)

    assert signed
           |> https_post("/backoffice/account", %{
             "current_password" => "synthetic-temporary-web-passphrase",
             "password" => "synthetic-personal-web-passphrase"
           })
           |> redirected_to() == "/backoffice/login"

    assert signed |> https_get("/backoffice/account") |> redirected_to() == "/backoffice/login"

    rotated =
      https_post(conn, "/backoffice/login", %{
        "method" => "password",
        "email" => owner.email,
        "password" => "synthetic-personal-web-passphrase"
      })

    assert rotated |> https_get("/backoffice/team") |> response(200)
  end

  defp https_post(conn, path, params \\ %{}),
    do: post(conn, "https://www.example.com" <> path, params)
end
