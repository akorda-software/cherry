defmodule SnackWeb.Controllers.Api.BillingController do
  use SnackWeb, :controller

  alias Snack.Billing

  def plans(conn, _params) do
    plans = Billing.list_plans()

    json(conn, %{
      plans:
        Enum.map(plans, fn plan ->
          %{
            id: plan.id,
            name: plan.name,
            stripePriceId: plan.stripe_price_id,
            amountCents: plan.amount_cents,
            currency: plan.currency,
            interval: plan.interval
          }
        end)
    })
  end

  def subscribe(conn, %{"planId" => plan_id}) do
    user = conn.assigns[:current_user]

    case Billing.subscribe(user, plan_id) do
      {:ok,
       %{
         customer_id: customer_id,
         customer_ephemeral_key_secret: customer_ephemeral_key_secret,
         pending_subscription_id: pending_subscription_id,
         payment_intent_client_secret: payment_intent_client_secret
       }} ->
        json(conn, %{
          customerId: customer_id,
          customerEphemeralKeySecret: customer_ephemeral_key_secret,
          pendingSubscriptionId: pending_subscription_id,
          paymentIntentClientSecret: payment_intent_client_secret
        })

      {:error, :already_subscribed} ->
        conn
        |> put_status(409)
        |> json(%{error: "already_subscribed"})

      {:error, :plan_not_found} ->
        conn
        |> put_status(404)
        |> json(%{error: "plan_not_found"})

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{error: inspect(reason)})
    end
  end

  def cancel(conn, _params) do
    user = conn.assigns[:current_user]

    case Billing.cancel(user) do
      {:ok, %{status: status}} ->
        json(conn, %{status: status})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{error: "not_found"})

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{error: inspect(reason)})
    end
  end

  def abandon_pending(conn, %{"pendingSubscriptionId" => pending_subscription_id}) do
    user = conn.assigns[:current_user]

    case Billing.abandon_pending_subscription(user, pending_subscription_id) do
      {:ok, _subscription} ->
        json(conn, %{status: "abandoned"})

      {:error, :not_found} ->
        conn
        |> put_status(404)
        |> json(%{error: "not_found"})

      {:error, :invalid_state} ->
        conn
        |> put_status(409)
        |> json(%{error: "invalid_state"})

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{error: inspect(reason)})
    end
  end

  def subscription(conn, _params) do
    user = conn.assigns[:current_user]

    case Billing.get_subscription(user) do
      nil ->
        json(conn, %{subscribed: false})

      subscription ->
        json(conn, %{
          subscribed: true,
          subscription: %{
            id: subscription.id,
            planId: subscription.plan_id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd:
              subscription.current_period_end &&
                DateTime.to_iso8601(subscription.current_period_end)
          }
        })
    end
  end
end
