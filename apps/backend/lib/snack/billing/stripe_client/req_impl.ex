defmodule Snack.Billing.StripeClient.ReqImpl do
  @moduledoc """
  Production StripeClient implementation using Req for HTTP calls.
  """

  @behaviour Snack.Billing.StripeClient

  defstruct [:api_key, :base_url]

  @type config :: %__MODULE__{api_key: String.t(), base_url: String.t()}

  @doc "Returns the current Stripe configuration from app env."
  @spec stripe_config() :: config()
  def stripe_config do
    stripe = Application.fetch_env!(:snack, :stripe)

    %__MODULE__{
      api_key: Map.fetch!(stripe, :api_key),
      base_url: Map.fetch!(stripe, :base_url)
    }
  end

  @impl true
  def create_customer(%{email: email}, _opts) do
    config = stripe_config()

    case Req.post(
           "#{config.base_url}/v1/customers",
           form: [email: email],
           headers: [{"authorization", "Bearer #{config.api_key}"}],
           receive_timeout: 5_000
         ) do
      {:ok, %{status: 200, body: %{"id" => id}}} ->
        {:ok, %{stripe_customer_id: id}}

      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def create_payment_sheet_session(
        %{customer_id: customer_id, amount_cents: amount_cents, currency: currency},
        _opts
      ) do
    config = stripe_config()

    with {:ok, %{status: 200, body: %{"secret" => ephemeral_key_secret}}} <-
           Req.post(
             "#{config.base_url}/v1/ephemeral_keys",
             form: [customer: customer_id],
             headers: [
               {"authorization", "Bearer #{config.api_key}"},
               {"stripe-version", "2024-06-20"}
             ],
             receive_timeout: 5_000
           ),
         {:ok, %{status: 200, body: %{"client_secret" => payment_intent_client_secret}}} <-
           Req.post(
             "#{config.base_url}/v1/payment_intents",
             form: [
               customer: customer_id,
               amount: amount_cents,
               currency: currency,
               "automatic_payment_methods[enabled]": true
             ],
             headers: [{"authorization", "Bearer #{config.api_key}"}],
             receive_timeout: 5_000
           ) do
      {:ok,
       %{
         customer_id: customer_id,
         customer_ephemeral_key_secret: ephemeral_key_secret,
         payment_intent_client_secret: payment_intent_client_secret
       }}
    else
      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def cancel_subscription(subscription_id, _opts) do
    config = stripe_config()

    case Req.delete(
           "#{config.base_url}/v1/subscriptions/#{subscription_id}",
           form: [cancel_at_period_end: true],
           headers: [{"authorization", "Bearer #{config.api_key}"}],
           receive_timeout: 5_000
         ) do
      {:ok, %{status: 200}} ->
        {:ok, %{status: "canceling"}}

      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl true
  def list_prices(_opts) do
    config = stripe_config()

    case Req.get(
           "#{config.base_url}/v1/prices",
           headers: [{"authorization", "Bearer #{config.api_key}"}],
           receive_timeout: 5_000
         ) do
      {:ok, %{status: 200, body: %{"data" => data}}} ->
        prices =
          Enum.map(data, fn price ->
            %{
              id: price["id"],
              amount: price["unit_amount"],
              currency: price["currency"],
              interval: price["recurring"]["interval"]
            }
          end)

        {:ok, prices}

      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
