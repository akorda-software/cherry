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
        "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
      )

    if Application.get_env(:cherry, :backoffice_enabled, false) do
      if CherryWeb.TransportSecurity.https?(conn) do
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

  @doc "The verified session token of this request, to tell it apart from the member's others."
  def token(conn), do: conn.cookies[@cookie]

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
end
