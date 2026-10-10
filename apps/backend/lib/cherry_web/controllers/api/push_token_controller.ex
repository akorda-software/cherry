defmodule CherryWeb.Controllers.Api.PushTokenController do
  use CherryWeb, :controller

  alias Cherry.Sessions
  alias Cherry.Sessions.PushToken

  def create(conn, params) do
    user = conn.assigns.current_user
    session_id = conn.assigns.current_session_id

    case Sessions.register_push_token(user, session_id, params) do
      {:ok, push_token} ->
        json(conn, %{ok: true, pushToken: serialize_push_token(push_token)})

      {:error, reason}
      when reason in [:session_revoked, :device_mismatch, :invalid_push_token_payload] ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: Atom.to_string(reason)})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  defp serialize_push_token(%PushToken{} = push_token) do
    %{
      id: push_token.id,
      platform: push_token.platform,
      installationId: push_token.installation_id,
      status: push_token.status,
      lastSeenAt: push_token.last_seen_at
    }
  end

  defp format_errors(changeset), do: CherryWeb.ChangesetJSON.errors(changeset)
end
