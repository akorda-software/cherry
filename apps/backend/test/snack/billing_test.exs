defmodule Snack.BillingTest do
  use Snack.DataCase, async: false

  alias Snack.Accounts
  alias Snack.Billing
  alias Snack.Billing.Customer
  alias Snack.Billing.Plan
  alias Snack.Billing.ProcessedEvent
  alias Snack.Billing.Subscription

  setup do
    original_stripe_client = Application.get_env(:snack, :stripe_client)
    Application.put_env(:snack, :stripe_client, Snack.Billing.MockStripeClient)

    on_exit(fn ->
      if original_stripe_client do
        Application.put_env(:snack, :stripe_client, original_stripe_client)
      else
        Application.delete_env(:snack, :stripe_client)
      end
    end)

    {:ok, user} =
      Accounts.create_user(%{email: "billing_test@example.com", display_name: "Billing Tester"})

    {:ok, plan} =
      %Plan{}
      |> Plan.changeset(%{
        name: "Pro",
        stripe_price_id: "price_billing_test",
        amount_cents: 999,
        currency: "usd",
        interval: "month"
      })
      |> Repo.insert()

    %{user: user, plan: plan}
  end

  describe "list_plans/0" do
    test "returns all plans from database" do
      plans = Billing.list_plans()
      assert is_list(plans)
      assert length(plans) >= 1
      assert %Plan{name: "Pro"} = Enum.find(plans, &(&1.name == "Pro"))
    end

    test "returns empty list when no plans exist" do
      Repo.delete_all(Plan)
      assert Billing.list_plans() == []
    end
  end

  describe "subscribe/2" do
    test "creates payment sheet session for new subscriber", %{user: user, plan: plan} do
      assert {:ok,
              %{
                customer_id: "cus_mock_" <> _,
                customer_ephemeral_key_secret: "ek_mock_" <> _,
                payment_intent_client_secret: "pi_mock_secret_" <> _
              }} =
               Billing.subscribe(user, plan.id)
    end

    test "creates billing customer if not existing", %{user: user, plan: plan} do
      Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)
      assert customer != nil
      assert customer.stripe_customer_id =~ "cus_mock_"
    end

    test "reuses existing customer for returning subscriber", %{user: user, plan: plan} do
      {:ok, _customer} =
        %Customer{}
        |> Customer.changeset(%{
          user_id: user.id,
          stripe_customer_id: "cus_existing_123",
          email: user.email
        })
        |> Repo.insert()

      Billing.subscribe(user, plan.id)

      customers = Repo.all(from(c in Customer, where: c.user_id == ^user.id))
      assert length(customers) == 1
    end

    test "returns 409 when user already has active subscription", %{user: user, plan: plan} do
      # First subscription succeeds
      {:ok, _} = Billing.subscribe(user, plan.id)

      # Second subscription returns conflict
      assert {:error, :already_subscribed} = Billing.subscribe(user, plan.id)
    end

    test "returns error for non-existent plan", %{user: user} do
      assert {:error, :plan_not_found} = Billing.subscribe(user, Ecto.UUID.generate())
    end
  end

  describe "cancel/1" do
    test "cancels an active subscription", %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      # Simulate Stripe webhook promoting the pending sub to active.
      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      sub
      |> Subscription.changeset(%{
        status: "active",
        current_period_end: DateTime.from_unix!(1_850_000_000),
        stripe_event_id: "evt_promote_cancel_#{System.unique_integer([:positive])}"
      })
      |> Repo.update!()

      assert {:ok, canceled} = Billing.cancel(user)
      assert canceled.status == "canceling"
      assert canceled.cancel_at_period_end == true
      assert canceled.current_period_end == DateTime.from_unix!(1_800_000_000)
    end

    test "refuses to cancel a pending subscription (must use abandon_pending)",
         %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      # Nothing has promoted the pending sub to active yet, so cancel must 404.
      assert {:error, :not_found} = Billing.cancel(user)
    end

    test "returns 404 when no subscription exists", %{user: user} do
      assert {:error, :not_found} = Billing.cancel(user)
    end

    test "keeps the local subscription untouched when Stripe cancellation fails", %{
      user: user,
      plan: plan
    } do
      Application.put_env(:snack, :stripe_client, Snack.Billing.FailingStripeClient)

      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      sub
      |> Subscription.changeset(%{
        status: "active",
        stripe_event_id: "evt_promote_cancel_fail_#{System.unique_integer([:positive])}"
      })
      |> Repo.update!()

      assert {:error, {:stripe_cancel_failed, :stripe_down}} = Billing.cancel(user)

      persisted = Repo.get!(Subscription, sub.id)
      assert persisted.status == "active"
      assert persisted.cancel_at_period_end == false
    end
  end

  describe "get_subscription/1" do
    test "returns nil when user has no subscription", %{user: user} do
      assert Billing.get_subscription(user) == nil
    end

    test "returns subscription for subscribed user", %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      subscription = Billing.get_subscription(user)
      assert subscription != nil
      assert subscription.status in ["pending", "active"]
    end

    test "treats past_due as a blocking subscription state", %{user: user, plan: plan} do
      {:ok, %{stripe_subscription_id: stripe_subscription_id}} = Billing.subscribe(user, plan.id)

      event = %{
        "id" => "evt_past_due_#{System.unique_integer([:positive])}",
        "type" => "customer.subscription.updated",
        "data" => %{
          "object" => %{
            "id" => stripe_subscription_id,
            "status" => "past_due"
          }
        }
      }

      assert {:ok, updated} = Billing.handle_event(event)
      assert updated.status == "past_due"
      assert {:error, :already_subscribed} = Billing.subscribe(user, plan.id)
    end
  end

  describe "handle_event/1" do
    test "promotes the pending subscription to active on customer.subscription.updated",
         %{user: user, plan: plan} do
      {:ok, %{stripe_subscription_id: real_stripe_sub_id}} = Billing.subscribe(user, plan.id)

      event_id = "evt_activated_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.updated",
        "data" => %{
          "object" => %{
            "id" => real_stripe_sub_id,
            "status" => "active"
          }
        }
      }

      assert {:ok, updated} = Billing.handle_event(event)
      assert updated.status == "active"
      assert updated.stripe_subscription_id == real_stripe_sub_id
      assert updated.stripe_event_id == event_id
    end

    test "updates only the subscription whose stripe id matches the event",
         %{user: user, plan: plan} do
      {:ok, other_user} =
        Accounts.create_user(%{email: "other@example.com", display_name: "Other"})

      {:ok, _} = Billing.subscribe(user, plan.id)
      {:ok, _} = Billing.subscribe(other_user, plan.id)

      target_customer = Repo.get_by(Customer, user_id: user.id)

      target_sub =
        Repo.one(
          from(s in Subscription,
            where: s.customer_id == ^target_customer.id,
            limit: 1
          )
        )

      real_stripe_sub_id = "sub_target_#{System.unique_integer([:positive])}"

      target_sub
      |> Subscription.changeset(%{
        stripe_subscription_id: real_stripe_sub_id,
        stripe_event_id: "evt_promote_#{System.unique_integer([:positive])}",
        status: "active"
      })
      |> Repo.update!()

      event_id = "evt_updated_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.updated",
        "data" => %{
          "object" => %{
            "id" => real_stripe_sub_id,
            "status" => "past_due"
          }
        }
      }

      assert {:ok, updated} = Billing.handle_event(event)
      assert updated.id == target_sub.id
      assert updated.status == "past_due"

      other_customer = Repo.get_by(Customer, user_id: other_user.id)

      other_sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^other_customer.id, limit: 1))

      assert other_sub.status == "pending"
    end

    test "skips customer.subscription.updated when stripe subscription id is unknown",
         %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      event_id = "evt_unknown_sub_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.updated",
        "data" => %{
          "object" => %{
            "id" => "sub_not_in_db",
            "status" => "active"
          }
        }
      }

      assert {:ok, {:skipped, :subscription_not_found}} = Billing.handle_event(event)
    end

    test "marks subscription canceled on customer.subscription.deleted",
         %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      real_stripe_sub_id = "sub_for_delete_#{System.unique_integer([:positive])}"

      sub
      |> Subscription.changeset(%{
        stripe_subscription_id: real_stripe_sub_id,
        stripe_event_id: "evt_delete_promote_#{System.unique_integer([:positive])}",
        status: "active"
      })
      |> Repo.update!()

      event_id = "evt_deleted_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.deleted",
        "data" => %{"object" => %{"id" => real_stripe_sub_id, "status" => "canceled"}}
      }

      assert {:ok, updated} = Billing.handle_event(event)
      assert updated.status == "canceled"
    end

    test "stores processed webhook events and treats retries as idempotent", %{
      user: user,
      plan: plan
    } do
      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      real_stripe_sub_id = "sub_idem_#{System.unique_integer([:positive])}"

      sub
      |> Subscription.changeset(%{
        stripe_subscription_id: real_stripe_sub_id,
        stripe_event_id: "evt_idem_promote_#{System.unique_integer([:positive])}",
        status: "active"
      })
      |> Repo.update!()

      event_id = "evt_idempotent_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.updated",
        "data" => %{"object" => %{"id" => real_stripe_sub_id, "status" => "active"}}
      }

      assert {:ok, _} = Billing.handle_event(event)
      assert {:ok, :already_processed} = Billing.handle_event(event)
      assert Repo.aggregate(ProcessedEvent, :count, :id) == 1
    end

    test "does not reprocess an older event after a newer one updated the same subscription", %{
      user: user,
      plan: plan
    } do
      {:ok, %{stripe_subscription_id: stripe_subscription_id}} = Billing.subscribe(user, plan.id)

      first_event = %{
        "id" => "evt_old_#{System.unique_integer([:positive])}",
        "type" => "customer.subscription.updated",
        "data" => %{"object" => %{"id" => stripe_subscription_id, "status" => "active"}}
      }

      second_event = %{
        "id" => "evt_new_#{System.unique_integer([:positive])}",
        "type" => "customer.subscription.updated",
        "data" => %{"object" => %{"id" => stripe_subscription_id, "status" => "past_due"}}
      }

      assert {:ok, updated_once} = Billing.handle_event(first_event)
      assert updated_once.status == "active"

      assert {:ok, updated_twice} = Billing.handle_event(second_event)
      assert updated_twice.status == "past_due"

      assert {:ok, :already_processed} = Billing.handle_event(first_event)

      persisted = Repo.get!(Subscription, updated_twice.id)
      assert persisted.status == "past_due"
      assert persisted.stripe_event_id == second_event["id"]
      assert Repo.aggregate(ProcessedEvent, :count, :id) == 2
    end
  end
end
