defmodule CherryWeb.Plugs.BackofficeSession do
  import Plug.Conn
  alias Cherry.Backoffice.Access
  @cookie "_cherry_backoffice"
  def init(opts), do: opts

  def call(conn, _opts) do
    conn =
      conn
      |> put_resp_header("cache-control", "no-store, no-transform")
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

        conn
        |> assign(:current_staff, Access.authenticate(conn.cookies[@cookie]))
        |> require_password_change()
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

  defp require_password_change(
         %{assigns: %{current_staff: %{password_change_required: true}}} = conn
       ) do
    if conn.request_path in ["/backoffice/account", "/backoffice/logout"] do
      conn
    else
      conn |> Phoenix.Controller.redirect(to: "/backoffice/account") |> halt()
    end
  end

  defp require_password_change(conn), do: conn

  defp https?(conn) do
    origin = conn.private[:transport_origin] || %{scheme: conn.scheme, peer_ip: conn.remote_ip}

    origin.scheme == :https or
      (trusted_peer?(origin.peer_ip) and
         get_req_header(conn, "x-forwarded-proto") == ["https"])
  end

  # An IPv4 socket accepted by the dual-stack listener can be represented as
  # ::ffff:a.b.c.d. Normalize the address, never broaden the configured allowlist.
  defp trusted_peer?(ip) do
    Enum.any?(
      Application.get_env(:cherry, :backoffice_trusted_proxy_ips, []),
      &(normalize_ip(&1) == normalize_ip(ip))
    )
  end

  defp normalize_ip({0, 0, 0, 0, 0, 65_535, a, b}),
    do: {div(a, 256), rem(a, 256), div(b, 256), rem(b, 256)}

  defp normalize_ip(ip), do: ip
end
