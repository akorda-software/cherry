defmodule CherryWeb.Plugs.RequireLegalAcceptance do
  @moduledoc "Staged legal gate; rights, notices, blocking, logout and erasure never require re-consent."
  import Plug.Conn
  def init(opts), do: opts

  def call(conn, _) do
    if exempt?(conn) or Cherry.Legal.permitted?(conn.assigns.current_user) do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> Phoenix.Controller.json(%{error: "legal_acceptance_required"})
      |> halt()
    end
  end

  defp exempt?(%{method: method, request_path: path}) do
    path in ["/api/bootstrap", "/api/me/legal"] or
      String.starts_with?(path, "/api/me/cases") or String.starts_with?(path, "/api/me/notices") or
      (method == "DELETE" and path == "/api/me/account") or
      (method == "POST" and path == "/api/me/pause") or
      (method == "GET" and path == "/api/me/profile") or
      (method == "POST" and Regex.match?(~r{\A/api/users/[^/]+/(block|report)\z}, path))
  end
end
