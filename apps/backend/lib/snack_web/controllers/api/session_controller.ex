defmodule SnackWeb.Controllers.Api.SessionController do
  use SnackWeb, :controller

  alias Snack.Sessions

  def refresh(conn, %{"refreshToken" => refresh_token}) do
    case Sessions.refresh_session(refresh_token) do
      {:ok, refreshed} ->
        json(conn, session_payload(refreshed.session))

      {:error, reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: Atom.to_string(reason)})
    end
  end

  def delete(conn, %{"refreshToken" => refresh_token}) do
    :ok = Sessions.revoke_session(refresh_token)
    send_resp(conn, :no_content, "")
  end

  defp session_payload(session) do
    %{
      accessToken: session.access_token,
      accessTokenExpiresAt: session.access_token_expires_at,
      refreshToken: session.refresh_token,
      refreshTokenExpiresAt: session.refresh_token_expires_at,
      user: %{
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.display_name
      }
    }
  end
end
