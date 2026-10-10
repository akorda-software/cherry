defmodule CherryWeb.Plugs.Cors do
  @moduledoc """
  CORS mínimo para la API. La app nativa no lo necesita; existe para Expo Web
  en desarrollo y para instancias self-hosted que sirvan un cliente web.

  Orígenes permitidos en `config :cherry, :cors_allowed_origins`: lista de
  orígenes exactos o `:any`. Lista vacía (por defecto) ⇒ no se emiten cabeceras.
  La API se autentica con Bearer tokens (sin cookies), así que no se permiten
  credenciales.
  """
  import Plug.Conn

  @allowed_methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  # `if-none-match`: la subida local de fotos (PUT /api/uploads/:token) exige
  # enviar todos los headers del intent, incluido `If-None-Match: *`.
  @allowed_headers "authorization, content-type, accept, if-none-match"

  def init(opts), do: opts

  def call(conn, _opts) do
    origin = conn |> get_req_header("origin") |> List.first()

    if origin && allowed?(origin) do
      conn =
        conn
        |> put_resp_header("access-control-allow-origin", origin)
        |> put_resp_header("vary", "origin")

      if conn.method == "OPTIONS" do
        conn
        |> put_resp_header("access-control-allow-methods", @allowed_methods)
        |> put_resp_header("access-control-allow-headers", @allowed_headers)
        |> put_resp_header("access-control-max-age", "600")
        |> send_resp(204, "")
        |> halt()
      else
        conn
      end
    else
      conn
    end
  end

  defp allowed?(origin) do
    case Application.get_env(:cherry, :cors_allowed_origins, []) do
      :any -> true
      origins when is_list(origins) -> origin in origins
      _other -> false
    end
  end
end
