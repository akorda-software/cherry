defmodule CherryWeb.Plugs.BackofficeHost do
  @moduledoc """
  Optional host boundary between the public product and the staff backoffice.

  Uses the actual request host, never a forwarded-host header. It must run before
  Phoenix's socket dispatch, static files, body parsing and session handling.
  """
  @behaviour Plug
  import Plug.Conn

  @impl true
  def init(opts), do: opts

  @impl true
  def call(conn, _opts) do
    case Application.get_env(:cherry, :backoffice_host) do
      nil ->
        conn

      host ->
        if String.downcase(conn.host) |> String.trim_trailing(".") == host do
          admin(conn)
        else
          if match?(["backoffice" | _], conn.path_info), do: not_found(conn), else: conn
        end
    end
  end

  defp admin(conn) do
    conn = private_headers(conn)

    if Application.get_env(:cherry, :backoffice_enabled, false) do
      case {conn.method, conn.path_info} do
        {method, []} when method in ["GET", "HEAD"] ->
          conn |> put_resp_header("location", "/backoffice") |> send_resp(302, "") |> halt()

        {_, ["backoffice" | _]} ->
          conn

        {method, ["robots.txt"]} when method in ["GET", "HEAD"] ->
          conn
          |> put_resp_content_type("text/plain")
          |> send_resp(200, if(method == "HEAD", do: "", else: "User-agent: *\nDisallow: /\n"))
          |> halt()

        {method, ["assets", file]} when method in ["GET", "HEAD"] ->
          # Phoenix may replace the stylesheet with its fingerprinted asset.
          if Regex.match?(~r/\Abackoffice(?:-[0-9a-f]{32})?\.css\z/, file),
            do: conn,
            else: not_found(conn)

        _ ->
          not_found(conn)
      end
    else
      not_found(conn)
    end
  end

  defp not_found(conn) do
    conn
    |> private_headers()
    |> put_resp_content_type("text/plain")
    |> send_resp(404, "Not found")
    |> halt()
  end

  defp private_headers(conn) do
    conn
    |> put_resp_header("cache-control", "no-store, no-transform")
    |> put_resp_header("referrer-policy", "no-referrer")
    |> put_resp_header("x-robots-tag", "noindex, nofollow")
  end
end
