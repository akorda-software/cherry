defmodule CherryWeb.PageController do
  use CherryWeb, :controller
  plug(:put_layout, false)
  plug(:put_root_layout, false)
  plug(:public_headers)

  def home(conn, _params) do
    render(conn, :home, instance: Cherry.Instance.info())
  end

  def legal(conn, _) do
    case Cherry.PublicSite.document(conn.assigns.legal_slug) do
      nil -> conn |> put_status(:not_found) |> text("Página no encontrada.")
      document -> render(conn, :legal, instance: Cherry.Instance.info(), document: document)
    end
  end

  def contact(conn, _), do: render(conn, :contact, instance: Cherry.Instance.info())
  def deletion(conn, _), do: render(conn, :deletion, instance: Cherry.Instance.info())

  defp public_headers(conn, _) do
    conn
    |> put_resp_header(
      "content-security-policy",
      "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    )
    |> put_resp_header("referrer-policy", "no-referrer")
    # Preserve public contact details without Cloudflare email obfuscation and
    # its injected JS (which the intentionally script-free CSP would block).
    |> put_resp_header("cache-control", "no-cache, no-transform")
  end
end
