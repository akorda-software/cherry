defmodule CherryWeb.Plugs.BackofficeSession do
  import Plug.Conn
  alias Cherry.Backoffice.Access
  @cookie "_cherry_backoffice"
  def init(opts), do: opts

  def call(conn, _opts) do
    conn =
      conn
      |> put_resp_header("cache-control", "no-store")
      |> put_resp_header("referrer-policy", "no-referrer")
      |> put_resp_header("x-robots-tag", "noindex, nofollow")
      |> put_resp_header(
        "content-security-policy",
        "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
      )

    if Application.get_env(:cherry, :backoffice_enabled, false) do
      if https?(conn) do
        # The transport was validated above, not inferred from a free-form header.
        conn = %{conn | scheme: :https}
        conn = fetch_cookies(conn, signed: [@cookie])
        assign(conn, :current_staff, Access.authenticate(conn.cookies[@cookie]))
      else
        conn
        |> send_resp(426, "El backoffice requiere HTTPS y un proxy de confianza configurado.")
        |> halt()
      end
    else
      conn |> send_resp(404, "Not found") |> halt()
    end
  end

  def require_staff(%{assigns: %{current_staff: %Cherry.Backoffice.Staff{}}} = conn, _), do: conn

  def require_staff(conn, _),
    do: conn |> Phoenix.Controller.redirect(to: "/backoffice/login") |> halt()

  def sign_in(conn, token) do
    conn
    |> configure_session(renew: true)
    |> clear_session()
    |> put_resp_cookie(@cookie, token,
      sign: true,
      http_only: true,
      same_site: "Strict",
      secure: secure?(),
      path: "/backoffice",
      max_age: Access.session_seconds()
    )
  end

  def sign_out(conn) do
    Access.logout(conn.cookies[@cookie])

    conn
    |> configure_session(drop: true)
    |> delete_resp_cookie(@cookie, path: "/backoffice", secure: secure?(), same_site: "Strict")
  end

  defp secure?, do: Application.get_env(:cherry, :backoffice_secure_cookie, true)

  defp https?(conn) do
    origin = conn.private[:transport_origin] || %{scheme: conn.scheme, peer_ip: conn.remote_ip}

    origin.scheme == :https or
      (origin.peer_ip in Application.get_env(:cherry, :backoffice_trusted_proxy_ips, []) and
         get_req_header(conn, "x-forwarded-proto") == ["https"])
  end
end
