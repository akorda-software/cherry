defmodule Snack.Billing.StripeClient do
  @moduledoc """
  Behaviour defining the contract for Stripe API interactions.

  All Stripe calls in the Billing context go through this behaviour,
  enabling test doubles without HTTP mocking.
  """

  @type opts :: Keyword.t()

  @callback create_customer(params :: map(), opts()) ::
              {:ok, %{stripe_customer_id: String.t()}} | {:error, term()}

  @callback create_payment_sheet_session(params :: map(), opts()) ::
              {:ok,
               %{
                 customer_id: String.t(),
                 customer_ephemeral_key_secret: String.t(),
                 current_period_end: DateTime.t() | nil,
                 payment_intent_client_secret: String.t(),
                 stripe_subscription_id: String.t()
               }}
              | {:error, term()}

  @callback cancel_subscription(subscription_id :: String.t(), opts()) ::
              {:ok,
               %{
                 cancel_at_period_end: boolean(),
                 current_period_end: DateTime.t() | nil,
                 status: String.t()
               }}
              | {:error, term()}

  @callback list_prices(opts()) ::
              {:ok, [map()]} | {:error, term()}
end
