defmodule Snack.Billing.FailingStripeClient do
  @moduledoc false

  @behaviour Snack.Billing.StripeClient

  @impl true
  def create_customer(_params, _opts) do
    {:ok, %{stripe_customer_id: "cus_failing_test"}}
  end

  @impl true
  def create_payment_sheet_session(_params, _opts) do
    {:ok,
     %{
       customer_id: "cus_failing_test",
       customer_ephemeral_key_secret: "ek_failing_test",
       payment_intent_client_secret: "pi_failing_test",
       stripe_subscription_id: "sub_failing_test",
       current_period_end: DateTime.from_unix!(1_800_000_000)
     }}
  end

  @impl true
  def cancel_subscription(_subscription_id, _opts) do
    {:error, :stripe_down}
  end

  @impl true
  def list_prices(_opts) do
    {:ok, []}
  end
end
