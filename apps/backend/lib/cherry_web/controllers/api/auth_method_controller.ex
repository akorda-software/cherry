defmodule CherryWeb.Controllers.Api.AuthMethodController do
  use CherryWeb, :controller
  alias Cherry.Identity.AuthMethods
  plug(:private_headers)
  plug(:require_https)

  def index(conn, _), do: json(conn, AuthMethods.list(conn.assigns.current_user.id))

  def create(conn, params), do: mutate(conn, params, :link)
  def delete(conn, params), do: mutate(conn, params, :unlink)

  defp mutate(conn, params, action) do
    with {:ok, provider} <- AuthMethods.parse_provider(params["provider"]),
         {:ok, result} <-
           apply(AuthMethods, action, [
             conn.assigns.current_user.id,
             conn.assigns.current_session_id,
             provider,
             params
           ]) do
      json(conn, result)
    else
      {:error, reason} ->
        status =
          cond do
            reason in [:identity_in_use, :provider_already_linked, :last_auth_method] -> 409
            reason in [:erasure_protection_unavailable, :apple_revocation_pending] -> 503
            reason == :session_revoked -> 401
            true -> 422
          end

        conn |> put_status(status) |> json(%{error: Atom.to_string(reason)})
    end
  end

  defp private_headers(conn, _),
    do:
      conn
      |> put_resp_header("cache-control", "private, no-store")
      |> put_resp_header("referrer-policy", "no-referrer")

  defp require_https(conn, _) do
    if CherryWeb.TransportSecurity.https?(conn),
      do: conn,
      else: conn |> send_resp(426, "HTTPS required") |> halt()
  end
end
