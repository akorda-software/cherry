defmodule CherryWeb.TransportSecurity do
  @moduledoc false
  import Plug.Conn

  # Same TLS termination chain for backoffice and browser OAuth. Retain the
  # existing exact peer allowlist; never trust forwarding headers from a client.
  def https?(conn) do
    origin = conn.private[:transport_origin] || %{scheme: conn.scheme, peer_ip: conn.remote_ip}

    origin.scheme == :https or
      (Enum.any?(
         Application.get_env(:cherry, :backoffice_trusted_proxy_ips, []),
         &(normalize(&1) == normalize(origin.peer_ip))
       ) and
         get_req_header(conn, "x-forwarded-proto") == ["https"])
  end

  defp normalize({0, 0, 0, 0, 0, 65_535, a, b}),
    do: {div(a, 256), rem(a, 256), div(b, 256), rem(b, 256)}

  defp normalize(ip), do: ip
end
