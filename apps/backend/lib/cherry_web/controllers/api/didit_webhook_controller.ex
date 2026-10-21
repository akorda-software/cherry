defmodule CherryWeb.Controllers.Api.DiditWebhookController do
  @moduledoc """
  `POST /api/webhooks/didit`: Didit tells the backend that a verification
  session changed status (event `status.updated`, webhook v3).

  Authenticated by the HMAC-SHA256 of the raw body with the destination's
  secret (`DIDIT_WEBHOOK_SECRET`, header `X-Signature`, hex) and a timestamp
  at most five minutes away (`X-Timestamp`, Unix seconds). Without the secret
  it answers 503; a bad signature or timestamp is 401 (Didit does not retry).

  Only the session id and its status are read: a final status schedules
  `Cherry.Identity.ProviderDecisionWorker`, which asks Didit for the decision
  itself, exactly like the app's check. The body carries the holder's data
  and photos: the route is not logged (`log: false`) and the body is dropped
  with the request.
  """
  use CherryWeb, :controller

  alias Cherry.Identity.ProviderDecisionWorker

  @max_skew_seconds 300

  # Statuses that leave something to do: store or refuse the verification and
  # erase the session at Didit. "In Review" waits for a person's decision.
  @final ["approved", "declined", "expired", "kyc expired", "abandoned"]

  def create(conn, params) do
    with {:ok, secret} <- secret(),
         :ok <- verify_signature(conn, secret),
         :ok <- verify_timestamp(conn),
         :ok <- handle(params) do
      send_resp(conn, 200, "")
    else
      {:error, :not_configured} -> send_error(conn, 503, "webhook_unavailable")
      {:error, :unauthorized} -> send_error(conn, 401, "invalid_signature")
      # Didit retries 5xx deliveries.
      {:error, _enqueue} -> send_error(conn, 503, "try_again")
    end
  end

  defp secret do
    case Application.get_env(:cherry, :didit, [])[:webhook_secret] do
      secret when is_binary(secret) and secret != "" -> {:ok, secret}
      _ -> {:error, :not_configured}
    end
  end

  defp verify_signature(conn, secret) do
    expected =
      :crypto.mac(:hmac, :sha256, secret, conn.private[:raw_body] || "")
      |> Base.encode16(case: :lower)

    with [signature] <- get_req_header(conn, "x-signature"),
         true <- Plug.Crypto.secure_compare(String.downcase(signature), expected) do
      :ok
    else
      _ -> {:error, :unauthorized}
    end
  end

  defp verify_timestamp(conn) do
    with [value] <- get_req_header(conn, "x-timestamp"),
         {timestamp, ""} <- Integer.parse(value),
         true <- abs(System.system_time(:second) - timestamp) <= @max_skew_seconds do
      :ok
    else
      _ -> {:error, :unauthorized}
    end
  end

  defp handle(%{"session_id" => session_id, "status" => status})
       when is_binary(session_id) and is_binary(status) do
    with true <- String.downcase(status) in @final,
         {:ok, session_id} <- Ecto.UUID.cast(session_id),
         {:ok, _job} <- ProviderDecisionWorker.enqueue(session_id) do
      :ok
    else
      {:error, _} = error -> error
      _ignored -> :ok
    end
  end

  # Other events and statuses: nothing to do, but acknowledged.
  defp handle(_params), do: :ok

  defp send_error(conn, status, code), do: conn |> put_status(status) |> json(%{error: code})
end
