defmodule Snack.Billing.WebhookProcessor do
  @moduledoc """
  Processes incoming Stripe webhook events.

  Delegates to the Billing context, which reconciles the event against local
  records via the Stripe identifiers carried in the event body.
  """

  alias Snack.Billing

  @spec process(map()) :: {:ok, term()} | {:error, term()}
  def process(event) do
    Billing.handle_event(event)
  end
end
