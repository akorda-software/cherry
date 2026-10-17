defmodule CherryWeb.Plugs.BackofficeHostTest do
  use CherryWeb.ConnCase, async: false

  setup do
    keys = [:backoffice_host, :backoffice_enabled, :backoffice_trusted_proxy_ips, :force_ssl]
    previous = Map.new(keys, &{&1, Application.get_env(:cherry, &1)})
    Application.put_env(:cherry, :backoffice_host, "admin.cherry.example")
    Application.put_env(:cherry, :backoffice_enabled, true)
    Application.put_env(:cherry, :backoffice_trusted_proxy_ips, [])
    Application.put_env(:cherry, :force_ssl, false)

    on_exit(fn ->
      for {key, value} <- previous do
        if is_nil(value),
          do: Application.delete_env(:cherry, key),
          else: Application.put_env(:cherry, key, value)
      end
    end)

    :ok
  end

  test "the public and legacy hosts keep public pages and API, but not the staff routes" do
    for host <- [
          "cherry.example",
          "old.cherry.example",
          "127.0.0.1",
          "admin.cherry.example.evil.test"
        ] do
      assert request(host, "/") |> html_response(200) =~ "Las buenas conexiones"
      assert request(host, "/privacidad") |> html_response(200) =~ "privacidad"
      assert request(host, "/api/config") |> json_response(200)
      assert request(host, "/healthz") |> json_response(200)

      for path <- ["/backoffice", "/backoffice/login", "/backoffice/team", "/backoffice/cases/x"] do
        conn = request(host, path)
        assert response(conn, 404) == "Not found"
        assert conn.resp_cookies == %{}
        assert get_resp_header(conn, "location") == []
      end
    end
  end

  test "the staff host opens the panel and not the product, even before body parsing or socket dispatch" do
    root = request("admin.cherry.example", "/")
    assert redirected_to(root) == "/backoffice"
    assert get_resp_header(root, "x-robots-tag") == ["noindex, nofollow"]
    assert request("ADMIN.CHERRY.EXAMPLE.", "/backoffice/login") |> html_response(200)

    for path <- [
          "/privacidad",
          "/contacto",
          "/api/config",
          "/api/bootstrap",
          "/api/auth/google/callback",
          "/uploads/photos/example.jpg",
          "/socket/websocket",
          "/socket/longpoll",
          "/healthz",
          "/readyz",
          "/metrics",
          "/openapi.yaml",
          "/assets/public.css"
        ] do
      conn = request("admin.cherry.example", path)
      assert response(conn, 404) == "Not found"
      assert conn.halted
      assert conn.resp_cookies == %{}
      assert get_resp_header(conn, "cache-control") == ["no-store, no-transform"]
    end

    conn =
      build_conn()
      |> put_req_header("content-type", "application/json")
      |> post("https://admin.cherry.example/api/auth/google/callback", "not json")

    assert response(conn, 404) == "Not found"
  end

  test "only the panel stylesheet and deny-all robots are served as staff assets" do
    assert request("admin.cherry.example", "/assets/backoffice.css") |> response(200)

    conn = request("admin.cherry.example", "/robots.txt")
    assert response(conn, 200) == "User-agent: *\nDisallow: /\n"
    assert get_resp_header(conn, "x-robots-tag") == ["noindex, nofollow"]
    assert head(build_conn(), "https://admin.cherry.example/robots.txt") |> response(200) == ""

    for path <- ["/", "/robots.txt", "/assets/backoffice.css"] do
      assert post(build_conn(), "https://admin.cherry.example#{path}", %{}) |> response(404)
    end
  end

  test "forwarded-host headers cannot open the panel on a different host or expose the product on admin" do
    for header <- ["x-forwarded-host", "forwarded"] do
      conn =
        build_conn()
        |> put_req_header(header, "admin.cherry.example")
        |> get("https://cherry.example/backoffice/login")

      assert response(conn, 404)

      conn =
        build_conn()
        |> put_req_header(header, "cherry.example")
        |> get("https://admin.cherry.example/api/config")

      assert response(conn, 404)
    end
  end

  test "a public-host login cannot consume a code; staff login still requires genuine CSRF and host-only cookies" do
    alias Cherry.Backoffice.Access

    {:ok, staff} =
      Access.provision("host-staff-#{System.unique_integer([:positive])}@example.test", "admin")

    {:ok, code} = Access.issue_login(staff.email)

    for host <- ["cherry.example", "old.cherry.example"] do
      conn = post(build_conn(), "https://#{host}/backoffice/login", %{"code" => code})
      assert response(conn, 404)
      assert conn.resp_cookies == %{}
    end

    login = request("admin.cherry.example", "/backoffice/login")
    [_, csrf] = Regex.run(~r/name="_csrf_token"[^>]*value="([^"]+)"/, html_response(login, 200))

    signed =
      login
      |> recycle()
      |> put_private(:plug_skip_csrf_protection, false)
      |> post("https://admin.cherry.example/backoffice/login", %{
        "code" => code,
        "_csrf_token" => csrf
      })

    assert redirected_to(signed) == "/backoffice"
    cookie = signed.resp_cookies["_cherry_backoffice"]
    assert cookie.secure and cookie.http_only
    assert cookie.same_site == "Strict"
    refute Map.has_key?(cookie, :domain)
    assert signed |> get("https://admin.cherry.example/backoffice") |> html_response(200)

    # Even an explicitly replayed staff cookie does not open a public-host route.
    conn =
      build_conn()
      |> put_req_cookie("_cherry_backoffice", cookie.value)
      |> get("https://cherry.example/backoffice")

    assert response(conn, 404)
    assert {:error, :invalid_code} = Access.exchange(code)
  end

  test "moving to the staff host does not weaken HTTPS validation" do
    assert get(build_conn(), "http://admin.cherry.example/backoffice/login") |> response(426)

    conn =
      build_conn()
      |> put_req_header("x-forwarded-proto", "https")
      |> get("http://admin.cherry.example/backoffice/login")

    assert response(conn, 426)
    Application.put_env(:cherry, :backoffice_trusted_proxy_ips, [{127, 0, 0, 1}])

    conn =
      build_conn()
      |> Map.put(:remote_ip, {127, 0, 0, 1})
      |> put_req_header("x-forwarded-proto", "https")
      |> get("http://admin.cherry.example/backoffice/login")

    assert html_response(conn, 200)
  end

  test "disabling staff access closes the entire staff host" do
    Application.put_env(:cherry, :backoffice_enabled, false)

    for path <- ["/", "/backoffice/login", "/assets/backoffice.css", "/robots.txt"] do
      assert request("admin.cherry.example", path) |> response(404)
    end
  end

  test "without a dedicated host, self-hosted instances keep their existing routing" do
    Application.delete_env(:cherry, :backoffice_host)
    assert request("cherry.example", "/backoffice/login") |> html_response(200)
    assert request("admin.cherry.example", "/api/config") |> json_response(200)
  end

  defp request(host, path), do: get(build_conn(), "https://#{host}#{path}")
end
