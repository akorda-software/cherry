defmodule CherryWeb.MediaUrl do
  @moduledoc """
  Convierte URLs de medios almacenadas en BD en URLs absolutas para la API.

  Los adaptadores de almacenamiento remotos (R2/S3) guardan URLs absolutas; el
  adaptador local guarda rutas relativas (`/uploads/...`) para que la misma BD
  sirva a clientes que llegan por distintos hosts (LAN, localhost, dominio
  público). Las rutas relativas se resuelven contra `:public_base_url` si está
  configurado, o contra el host de la petición.
  """

  @spec absolute(Plug.Conn.t() | nil, String.t() | nil) :: String.t() | nil
  def absolute(_conn, nil), do: nil
  def absolute(_conn, "http://" <> _ = url), do: remote(url)
  def absolute(_conn, "https://" <> _ = url), do: remote(url)

  def absolute(conn, "/" <> _ = path) do
    base_url(conn) <> path
  end

  def absolute(_conn, other), do: other

  # Signing is deliberately at the response boundary, after domain authorization.
  # Never persist signed URLs or replace an unavailable signer with a public URL.
  defp remote(url) do
    case Cherry.Storage.R2.storage_key(url) do
      nil ->
        # Signing failure must not reveal a raw R2 download address.
        if String.ends_with?(URI.parse(url).host || "", ".r2.cloudflarestorage.com"),
          do: nil,
          else: url

      key ->
        case Cherry.Storage.R2.presign_get(key) do
          {:ok, signed} -> signed
          _ -> nil
        end
    end
  end

  def reference(conn, "/" <> _ = path), do: base_url(conn) <> path
  def reference(_conn, url), do: url

  @spec base_url(Plug.Conn.t() | nil) :: String.t()
  def base_url(conn) do
    case Application.get_env(:cherry, :public_base_url) do
      base when is_binary(base) and base != "" ->
        String.trim_trailing(base, "/")

      _unset when is_struct(conn, Plug.Conn) ->
        port_suffix =
          case {conn.scheme, conn.port} do
            {:http, 80} -> ""
            {:https, 443} -> ""
            {_scheme, port} -> ":#{port}"
          end

        "#{conn.scheme}://#{conn.host}#{port_suffix}"

      _unset ->
        CherryWeb.Endpoint.url()
    end
  end
end
