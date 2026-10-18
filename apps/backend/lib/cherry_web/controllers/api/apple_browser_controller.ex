defmodule CherryWeb.Controllers.Api.AppleBrowserController do
  use CherryWeb, :controller
  alias Cherry.Identity.AppleBrowser

  plug(:security)

  def create(conn, params) do
    case AppleBrowser.start(params, conn.remote_ip) do
      {:ok, url} ->
        json(conn, %{authorizationUrl: url})

      {:error, :apple_browser_rate_limited} ->
        conn |> put_status(429) |> json(%{error: "apple_browser_rate_limited"})

      {:error, _} ->
        conn |> put_status(422) |> json(%{error: "invalid_apple_browser_request"})
    end
  end

  # Apple posts a cross-site form. OAuth state replaces browser-cookie CSRF here;
  # this route never fetches a session or accepts an arbitrary return URL.
  def callback(conn, params) do
    config = Application.fetch_env!(:cherry, :apple_browser)
    expected_host = URI.parse(config[:redirect_uri]).host

    if conn.host == expected_host do
      case AppleBrowser.complete(params) do
        {:ok, redirect} ->
          conn |> put_resp_header("location", redirect) |> send_resp(302, "")

        {:error, _} ->
          conn
          |> put_status(400)
          |> text("No se puede completar el acceso. Vuelve a la app e inténtalo de nuevo.")
      end
    else
      conn |> put_status(400) |> text("Retorno de acceso no válido.")
    end
  end

  defp security(conn, _) do
    conn =
      conn
      |> put_resp_header("cache-control", "private, no-store, no-transform")
      |> put_resp_header("referrer-policy", "no-referrer")
      |> put_resp_header("x-robots-tag", "noindex, nofollow")
      |> put_resp_header(
        "content-security-policy",
        "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      )

    cond do
      not AppleBrowser.enabled?() ->
        conn |> send_resp(404, "Not found") |> halt()

      not CherryWeb.TransportSecurity.https?(conn) ->
        conn |> send_resp(426, "HTTPS required") |> halt()

      true ->
        conn
    end
  end
end
