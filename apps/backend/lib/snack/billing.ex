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
  alias Snack.Billing.ProcessedEvent
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

  @doc """
  Cancel the caller's active subscription.

  Only `active` and `canceling` subscriptions go through the cancel flow — a
  pending subscription (payment not yet confirmed) must be released via
  `abandon_pending_subscription/2`, which is the path the mobile client uses
  when the user closes the Payment Sheet without paying.

  The Stripe call is only performed when we hold a real Stripe subscription
  id; if, for any reason, the local row has a local placeholder (e.g.
  migrations from older data), we skip the Stripe call to avoid 404s against
  non-existent resources.
  """
  def cancel(user) do
    case get_cancelable_subscription(user.id) do
      nil ->
        {:error, :not_found}

      subscription ->
        case maybe_cancel_stripe_subscription(subscription.stripe_subscription_id) do
          {:error, reason} ->
            {:error, {:stripe_cancel_failed, reason}}

          result ->
            cancel_attrs =
              subscription
              |> cancel_attrs_from_stripe_result(result)
              |> Map.put(:status, "canceling")
              |> Map.put(:cancel_at_period_end, true)

            subscription
            |> Subscription.changeset(cancel_attrs)
            |> Repo.update()
        end
    end
  end

  @doc """
  Abandon a local pending subscription whose Payment Sheet was dismissed.

  Best-effort cancels the matching Stripe-side subscription (created with
  `payment_behavior=default_incomplete` and otherwise auto-canceled by Stripe
  after 24 h) and then deletes the local row so the user can start a new
  subscribe attempt immediately.
  """
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
        case maybe_cancel_stripe_subscription(subscription.stripe_subscription_id) do
          {:error, reason} -> {:error, {:stripe_cancel_failed, reason}}
          _result -> Repo.delete(subscription)
        end

      _subscription ->
        {:error, :invalid_state}
    end
  end

  defp maybe_cancel_stripe_subscription(stripe_subscription_id) do
    cond do
      not is_binary(stripe_subscription_id) ->
        :skip

      String.starts_with?(stripe_subscription_id, "sub_local_") ->
        :skip

      true ->
        stripe_client().cancel_subscription(
          stripe_subscription_id,
          idempotency_key: cancel_idempotency_key(stripe_subscription_id)
        )
    end
  end

  defp cancel_attrs_from_stripe_result(subscription, {:ok, stripe_subscription}) do
    %{}
    |> Map.put(
      :current_period_end,
      stripe_subscription.current_period_end || subscription.current_period_end
    )
    |> Map.put(:cancel_at_period_end, stripe_subscription.cancel_at_period_end)
  end

  defp cancel_attrs_from_stripe_result(subscription, :skip) do
    %{
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end
    }
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
    case fetch_event_id(event) do
      {:ok, event_id} ->
        Multi.new()
        |> Multi.run(:processed_event, fn repo, _changes ->
          repo
          |> insert_processed_event(event_id, event["type"])
          |> normalize_processed_event_insert()
        end)
        |> Multi.run(:event_result, fn _repo, _changes ->
          do_handle_event(event, event_id)
        end)
        |> Repo.transaction()
        |> case do
          {:ok, %{event_result: result}} -> {:ok, result}
          {:error, :processed_event, :already_processed, _changes} -> {:ok, :already_processed}
          {:error, _step, reason, _changes} -> {:error, reason}
        end

      :error ->
        {:ok, {:skipped, :missing_event_id}}
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
          price_id: plan.stripe_price_id
        },
        idempotency_key: subscription_idempotency_key(customer.id, plan.id)
      )
    end)
    |> Multi.run(:subscription, fn repo, %{customer: customer, payment_sheet: payment_sheet} ->
      %Subscription{}
      |> Subscription.changeset(%{
        stripe_subscription_id: payment_sheet.stripe_subscription_id,
        # Local marker used only to satisfy the NOT NULL constraint on
        # stripe_event_id before Stripe has actually emitted any event for
        # this subscription. The first real event will overwrite it.
        stripe_event_id: "evt_local_pending_#{Ecto.UUID.generate()}",
        status: "pending",
        current_period_end: payment_sheet.current_period_end,
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
        {:ok, stripe_customer} =
          stripe_client().create_customer(
            %{email: user.email},
            idempotency_key: customer_idempotency_key(user.id)
          )

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
        where: s.status in ["pending", "active", "canceling", "past_due"],
        select: count(s.id)
      )
    ) > 0
  end

  # Subscriptions eligible for the cancel flow. A `pending` sub represents a
  # Payment Sheet that has not completed yet, and goes through
  # `abandon_pending_subscription/2` — not this path — so it is deliberately
  # excluded here.
  defp get_cancelable_subscription(user_id) do
    Repo.one(
      from(s in Subscription,
        where: s.customer_id in subquery(customer_ids_for_user(user_id)),
        where: s.status in ["active", "canceling"],
        preload: [:plan],
        limit: 1
      )
    )
  end

  defp customer_ids_for_user(user_id) do
    from(c in Customer, where: c.user_id == ^user_id, select: c.id)
  end

  defp fetch_event_id(%{"id" => event_id}) when is_binary(event_id) and event_id != "",
    do: {:ok, event_id}

  defp fetch_event_id(_event), do: :error

  defp insert_processed_event(repo, event_id, event_type) do
    %ProcessedEvent{}
    |> ProcessedEvent.changeset(%{event_id: event_id, event_type: event_type})
    |> repo.insert()
  end

  defp normalize_processed_event_insert({:ok, processed_event}), do: {:ok, processed_event}

  defp normalize_processed_event_insert({:error, %Ecto.Changeset{} = changeset}) do
    case Keyword.get(changeset.errors, :event_id) do
      {_message, details} when is_list(details) ->
        if Keyword.get(details, :constraint) == :unique do
          {:error, :already_processed}
        else
          {:error, changeset}
        end

      _ ->
        {:error, changeset}
    end
  end

  defp customer_idempotency_key(user_id), do: "billing:customer:create:user:#{user_id}"

  defp subscription_idempotency_key(customer_id, plan_id) do
    "billing:subscription:create:customer:#{customer_id}:plan:#{plan_id}"
  end

  defp cancel_idempotency_key(stripe_subscription_id) do
    "billing:subscription:cancel:#{stripe_subscription_id}"
  end

  # customer.subscription.updated is the event that Stripe fires after a
  # Payment Sheet confirms the initial invoice of a subscription created with
  # `payment_behavior=default_incomplete`. It carries the canonical status
  # transitions (incomplete -> active, active -> past_due, etc.). It must
  # mutate the exact local row that corresponds to `data.object.id` — picking
  # any other row would corrupt another user's state.
  defp do_handle_event(%{"type" => "customer.subscription.updated"} = event, event_id) do
    with {:ok, stripe_subscription_id} <- fetch_event_string(event, ["data", "object", "id"]),
         {:ok, subscription} <- fetch_subscription_by_stripe_id(stripe_subscription_id) do
      new_status = get_in(event, ["data", "object", "status"]) || subscription.status
      cancel_at_period_end = get_in(event, ["data", "object", "cancel_at_period_end"])
      current_period_end = current_period_end_from_event(event)

      subscription
      |> Subscription.changeset(%{
        status: normalize_stripe_subscription_status(new_status, cancel_at_period_end),
        stripe_event_id: event_id,
        cancel_at_period_end:
          if(is_boolean(cancel_at_period_end),
            do: cancel_at_period_end,
            else: subscription.cancel_at_period_end
          ),
        current_period_end: current_period_end || subscription.current_period_end
      })
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
      |> Subscription.changeset(%{
        status: "canceled",
        stripe_event_id: event_id,
        cancel_at_period_end: false,
        current_period_end:
          current_period_end_from_event(event) || subscription.current_period_end
      })
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

  defp fetch_subscription_by_stripe_id(stripe_subscription_id) do
    case Repo.get_by(Subscription, stripe_subscription_id: stripe_subscription_id) do
      nil -> {:error, :subscription_not_found}
      subscription -> {:ok, subscription}
    end
  end

  defp current_period_end_from_event(event) do
    case get_in(event, ["data", "object", "current_period_end"]) do
      unix when is_integer(unix) -> DateTime.from_unix!(unix)
      _ -> nil
    end
  end

  defp normalize_stripe_subscription_status(_status, true), do: "canceling"
  defp normalize_stripe_subscription_status("active", _), do: "active"
  defp normalize_stripe_subscription_status("trialing", _), do: "active"
  defp normalize_stripe_subscription_status("past_due", _), do: "past_due"
  defp normalize_stripe_subscription_status("unpaid", _), do: "past_due"
  defp normalize_stripe_subscription_status("canceled", _), do: "canceled"
  defp normalize_stripe_subscription_status(_, _), do: "pending"

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
