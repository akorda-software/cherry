defmodule Snack.Billing do
  @moduledoc """
  Self-contained Phoenix context for subscription billing.

  All Stripe API interactions go through the StripeClient behaviour,
  injected via app env :stripe_client for testability.
  """

  import Ecto.Query

  require Logger

  alias Ecto.Multi
  alias Snack.Billing.Customer
  alias Snack.Billing.Plan
  alias Snack.Billing.Subscription
  alias Snack.Repo

  defp stripe_client,
    do: Application.get_env(:snack, :stripe_client, Snack.Billing.StripeClient.ReqImpl)

  def list_plans do
    Repo.all(Plan)
  end

  def subscribe(user, plan_id) do
    plan = Repo.get(Plan, plan_id)

    cond do
      is_nil(plan) ->
        {:error, :plan_not_found}

      has_active_subscription?(user.id) ->
        {:error, :already_subscribed}

      true ->
        do_subscribe(user, plan)
    end
  end

  def cancel(user) do
    case get_active_subscription(user.id) do
      nil ->
        {:error, :not_found}

      subscription ->
        stripe_client().cancel_subscription(subscription.stripe_subscription_id, [])

        subscription
        |> Subscription.changeset(%{status: "canceling", cancel_at_period_end: true})
        |> Repo.update()
    end
  end

  def abandon_pending_subscription(user, subscription_id) do
    case Repo.one(
           from(s in Subscription,
             where: s.id == ^subscription_id,
             where: s.customer_id in subquery(customer_ids_for_user(user.id)),
             limit: 1
           )
         ) do
      nil ->
        {:error, :not_found}

      %Subscription{status: "pending"} = subscription ->
        Repo.delete(subscription)

      _subscription ->
        {:error, :invalid_state}
    end
  end

  def get_subscription(user) do
    Repo.one(
      from(s in Subscription,
        where: s.customer_id in subquery(customer_ids_for_user(user.id)),
        preload: [:plan],
        order_by: [desc: s.inserted_at],
        limit: 1
      )
    )
  end

  @doc """
  Process an incoming Stripe webhook event.

  Webhooks carry no user context, so reconciliation happens via the Stripe
  identifiers embedded in the event (`stripe_customer_id`,
  `stripe_subscription_id`). Handlers look up the local subscription from
  those identifiers — never from an externally supplied `user_id`.

  Events we don't have a handler for, and events whose identifiers don't
  match a local record, return `{:ok, reason}` so Stripe stops retrying. Only
  unexpected failures (DB errors) return `{:error, reason}` to trigger
  Stripe's retry behaviour.
  """
  def handle_event(event) do
    event_id = event["id"]

    case event_already_processed?(event_id) do
      true ->
        {:ok, :already_processed}

      false ->
        do_handle_event(event, event_id)
    end
  end

  defp do_subscribe(user, plan) do
    Multi.new()
    |> Multi.run(:customer, fn repo, _changes ->
      {:ok, get_or_create_customer(repo, user)}
    end)
    |> Multi.run(:payment_sheet, fn _repo, %{customer: customer} ->
      stripe_client().create_payment_sheet_session(
        %{
          customer_id: customer.stripe_customer_id,
          amount_cents: plan.amount_cents,
          currency: plan.currency,
          price_id: plan.stripe_price_id
        },
        []
      )
    end)
    |> Multi.run(:subscription, fn repo, %{customer: customer} ->
      %Subscription{}
      |> Subscription.changeset(%{
        stripe_subscription_id: "sub_pending_#{Ecto.UUID.generate()}",
        stripe_event_id: "evt_pending_#{Ecto.UUID.generate()}",
        status: "pending",
        customer_id: customer.id,
        plan_id: plan.id
      })
      |> repo.insert()
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{payment_sheet: payment_sheet, subscription: subscription}} ->
        {:ok, Map.put(payment_sheet, :pending_subscription_id, subscription.id)}

      {:error, _step, reason, _changes} ->
        {:error, reason}
    end
  end

  defp get_or_create_customer(repo, user) do
    case repo.get_by(Customer, user_id: user.id) do
      nil ->
        {:ok, stripe_customer} = stripe_client().create_customer(%{email: user.email}, [])

        {:ok, customer} =
          %Customer{}
          |> Customer.changeset(%{
            user_id: user.id,
            stripe_customer_id: stripe_customer.stripe_customer_id,
            email: user.email
          })
          |> repo.insert()

        customer

      customer ->
        customer
    end
  end

  defp has_active_subscription?(user_id) do
    Repo.one(
      from(s in Subscription,
        where: s.customer_id in subquery(customer_ids_for_user(user_id)),
        where: s.status in ["pending", "active", "canceling"],
        select: count(s.id)
      )
    ) > 0
  end

  defp get_active_subscription(user_id) do
    Repo.one(
      from(s in Subscription,
        where: s.customer_id in subquery(customer_ids_for_user(user_id)),
        where: s.status in ["pending", "active", "canceling"],
        preload: [:plan],
        limit: 1
      )
    )
  end

  defp customer_ids_for_user(user_id) do
    from(c in Customer, where: c.user_id == ^user_id, select: c.id)
  end

  defp event_already_processed?(event_id) do
    Repo.one(
      from(s in Subscription,
        where: s.stripe_event_id == ^event_id,
        select: count(s.id)
      )
    ) > 0
  end

  # checkout.session.completed fires after the mobile client confirms a
  # Payment Sheet. Resolve the local pending subscription via the Stripe
  # customer id from the event, then promote it to "active" with the real
  # Stripe subscription id.
  defp do_handle_event(%{"type" => "checkout.session.completed"} = event, event_id) do
    with {:ok, stripe_customer_id} <- fetch_event_string(event, ["data", "object", "customer"]),
         {:ok, customer} <- fetch_customer_by_stripe_id(stripe_customer_id),
         {:ok, pending} <- fetch_pending_subscription(customer.id) do
      stripe_sub_id = get_in(event, ["data", "object", "subscription"])

      attrs =
        %{status: "active", stripe_event_id: event_id}
        |> maybe_put(:stripe_subscription_id, stripe_sub_id)

      pending
      |> Subscription.changeset(attrs)
      |> Repo.update()
    else
      {:error, reason} -> log_and_ack(event_id, "checkout.session.completed", reason)
    end
  end

  # customer.subscription.updated must mutate the exact local row that
  # corresponds to the event's `data.object.id`. Anything else risks
  # cross-user state corruption.
  defp do_handle_event(%{"type" => "customer.subscription.updated"} = event, event_id) do
    with {:ok, stripe_subscription_id} <- fetch_event_string(event, ["data", "object", "id"]),
         {:ok, subscription} <- fetch_subscription_by_stripe_id(stripe_subscription_id) do
      new_status = get_in(event, ["data", "object", "status"]) || subscription.status

      subscription
      |> Subscription.changeset(%{status: new_status, stripe_event_id: event_id})
      |> Repo.update()
    else
      {:error, reason} -> log_and_ack(event_id, "customer.subscription.updated", reason)
    end
  end

  # customer.subscription.deleted is Stripe's signal that a subscription
  # ended. Reconcile by stripe_subscription_id and mark it canceled.
  defp do_handle_event(%{"type" => "customer.subscription.deleted"} = event, event_id) do
    with {:ok, stripe_subscription_id} <- fetch_event_string(event, ["data", "object", "id"]),
         {:ok, subscription} <- fetch_subscription_by_stripe_id(stripe_subscription_id) do
      subscription
      |> Subscription.changeset(%{status: "canceled", stripe_event_id: event_id})
      |> Repo.update()
    else
      {:error, reason} -> log_and_ack(event_id, "customer.subscription.deleted", reason)
    end
  end

  defp do_handle_event(%{"type" => _type}, _event_id) do
    {:ok, :unhandled_event_type}
  end

  defp fetch_event_string(event, path) do
    case get_in(event, path) do
      value when is_binary(value) and value != "" -> {:ok, value}
      _ -> {:error, :missing_field}
    end
  end

  defp fetch_customer_by_stripe_id(stripe_customer_id) do
    case Repo.get_by(Customer, stripe_customer_id: stripe_customer_id) do
      nil -> {:error, :customer_not_found}
      customer -> {:ok, customer}
    end
  end

  defp fetch_pending_subscription(customer_id) do
    case Repo.one(
           from(s in Subscription,
             where: s.customer_id == ^customer_id,
             where: s.status == "pending",
             order_by: [desc: s.inserted_at],
             limit: 1
           )
         ) do
      nil -> {:error, :no_pending_subscription}
      subscription -> {:ok, subscription}
    end
  end

  defp fetch_subscription_by_stripe_id(stripe_subscription_id) do
    case Repo.get_by(Subscription, stripe_subscription_id: stripe_subscription_id) do
      nil -> {:error, :subscription_not_found}
      subscription -> {:ok, subscription}
    end
  end

  defp maybe_put(attrs, _key, value) when value in [nil, ""], do: attrs
  defp maybe_put(attrs, key, value) when is_binary(value), do: Map.put(attrs, key, value)

  # Events we cannot reconcile (missing fields, unknown customer, etc.) are
  # logged and acknowledged so Stripe does not retry forever. True failures
  # (DB errors, unexpected crashes) bubble up as {:error, _} and surface as
  # 500 to Stripe via the webhook controller.
  defp log_and_ack(event_id, event_type, reason) do
    Logger.warning("stripe webhook: skipping event",
      event_id: event_id,
      event_type: event_type,
      reason: reason
    )

    {:ok, {:skipped, reason}}
  end
end
