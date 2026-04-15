defmodule Snack.Billing.MockStripeClient do
  @moduledoc """
  Mock StripeClient for tests. Returns predictable values.
  """

  @behaviour Snack.Billing.StripeClient

  @impl true
  def create_customer(%{email: email}, _opts) do
    {:ok, %{stripe_customer_id: "cus_mock_#{:erlang.phash2(email)}"}}
  end

  @impl true
  def create_payment_sheet_session(%{customer_id: customer_id}, _opts) do
    {:ok,
     %{
       customer_id: customer_id,
       customer_ephemeral_key_secret: "ek_mock_#{customer_id}",
       payment_intent_client_secret: "pi_mock_secret_#{customer_id}"
     }}
  end

  @impl true
  def cancel_subscription(_subscription_id, _opts) do
    {:ok, %{status: "canceling"}}
  end

  @impl true
  def list_prices(_opts) do
    {:ok,
     [
       %{
         id: "price_mock_pro",
         amount: 999,
         currency: "usd",
         interval: "month",
         product_name: "Pro"
       },
       %{
         id: "price_mock_team",
         amount: 2999,
         currency: "usd",
         interval: "month",
         product_name: "Team"
       }
     ]}
  end
end
