defmodule SnackWeb.MetricsController do
  use SnackWeb, :controller

  def show(conn, _params) do
    case Application.get_env(:snack, :metrics_token) do
      token when is_binary(token) and byte_size(token) > 0 ->
        if authorized?(conn, token) do
          conn
          |> put_resp_content_type("text/plain", "utf-8")
          |> put_resp_header("cache-control", "no-store")
          |> send_resp(200, Snack.Metrics.scrape())
        else
          send_resp(conn, 401, "Unauthorized")
        end

      _disabled ->
        send_resp(conn, 404, "Not found")
    end
  end

  defp authorized?(conn, token) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> provided] -> Plug.Crypto.secure_compare(provided, token)
      _ -> false
    end
  end
end
