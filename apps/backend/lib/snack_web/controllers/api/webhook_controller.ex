defmodule SnackWeb.Controllers.Api.WebhookController do
  use SnackWeb, :controller

  require Logger

  alias Snack.Billing.WebhookProcessor

  def stripe(conn, params) do
    case WebhookProcessor.process(params) do
      {:ok, _} ->
        send_resp(conn, 200, Jason.encode!(%{received: true}))

      {:error, reason} ->
        Logger.error("stripe webhook: processing failed",
          reason: inspect(reason),
          stripe_event_id: Map.get(params, "id"),
          stripe_event_type: Map.get(params, "type")
        )

        # Respond 500 so Stripe retries. Do not leak internal reasons in the body.
        send_resp(conn, 500, Jason.encode!(%{error: "processing_failed"}))
    end
  end
end
