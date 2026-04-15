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

  # Creates a real Stripe Subscription with payment_behavior=default_incomplete
  # so the first invoice's PaymentIntent can be confirmed by Payment Sheet on
  # the client. The returned subscription starts in status `incomplete`; once
  # the PaymentIntent succeeds, Stripe fires customer.subscription.updated
  # with status=active, which the webhook handler uses to promote the local
  # row from "pending" to "active".
  #
  # See https://docs.stripe.com/billing/subscriptions/build-subscriptions
  @impl true
  def create_payment_sheet_session(
        %{customer_id: customer_id, price_id: price_id},
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
         {:ok, %{status: 200, body: subscription_body}} <-
           Req.post(
             "#{config.base_url}/v1/subscriptions",
             form: [
               {"customer", customer_id},
               {"items[0][price]", price_id},
               {"payment_behavior", "default_incomplete"},
               {"payment_settings[save_default_payment_method]", "on_subscription"},
               {"expand[]", "latest_invoice.payment_intent"}
             ],
             headers: [{"authorization", "Bearer #{config.api_key}"}],
             receive_timeout: 5_000
           ),
         {:ok, stripe_subscription_id} <- fetch_subscription_id(subscription_body),
         current_period_end <- fetch_current_period_end(subscription_body),
         {:ok, payment_intent_client_secret} <-
           fetch_payment_intent_client_secret(subscription_body) do
      {:ok,
       %{
         customer_id: customer_id,
         customer_ephemeral_key_secret: ephemeral_key_secret,
         current_period_end: current_period_end,
         payment_intent_client_secret: payment_intent_client_secret,
         stripe_subscription_id: stripe_subscription_id
       }}
    else
      {:ok, %{status: status, body: body}} ->
        {:error, %{status: status, body: body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_subscription_id(%{"id" => id}) when is_binary(id), do: {:ok, id}
  defp fetch_subscription_id(_body), do: {:error, :missing_subscription_id}

  defp fetch_payment_intent_client_secret(body) do
    case get_in(body, ["latest_invoice", "payment_intent", "client_secret"]) do
      secret when is_binary(secret) -> {:ok, secret}
      _ -> {:error, :missing_payment_intent_client_secret}
    end
  end

  defp fetch_current_period_end(body) do
    case get_in(body, ["current_period_end"]) do
      unix when is_integer(unix) -> DateTime.from_unix!(unix)
      _ -> nil
    end
  end

  @impl true
  def cancel_subscription(subscription_id, _opts) do
    config = stripe_config()

    case Req.post(
           "#{config.base_url}/v1/subscriptions/#{subscription_id}",
           form: [cancel_at_period_end: true],
           headers: [{"authorization", "Bearer #{config.api_key}"}],
           receive_timeout: 5_000
         ) do
      {:ok, %{status: 200, body: body}} ->
        {:ok,
         %{
           status: Map.get(body, "status", "active"),
           cancel_at_period_end: Map.get(body, "cancel_at_period_end", false),
           current_period_end: fetch_current_period_end(body)
         }}

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
