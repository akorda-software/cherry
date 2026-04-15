defmodule Snack.BillingTest do
  use Snack.DataCase, async: false

  alias Snack.Accounts
  alias Snack.Billing
  alias Snack.Billing.Customer
  alias Snack.Billing.Plan
  alias Snack.Billing.Subscription

  setup do
    Application.put_env(:snack, :stripe_client, Snack.Billing.MockStripeClient)

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
    test "cancels active subscription", %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      assert {:ok, %{status: "canceling"}} = Billing.cancel(user)
    end

    test "returns 404 when no active subscription", %{user: user} do
      assert {:error, :not_found} = Billing.cancel(user)
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
  end

  describe "handle_event/1" do
    test "promotes the pending subscription to active on checkout.session.completed",
         %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)
      real_stripe_sub_id = "sub_live_#{System.unique_integer([:positive])}"
      event_id = "evt_completed_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "checkout.session.completed",
        "data" => %{
          "object" => %{
            "customer" => customer.stripe_customer_id,
            "subscription" => real_stripe_sub_id
          }
        }
      }

      assert {:ok, updated} = Billing.handle_event(event)
      assert updated.status == "active"
      assert updated.stripe_subscription_id == real_stripe_sub_id
      assert updated.stripe_event_id == event_id
    end

    test "skips checkout.session.completed when the stripe customer is unknown" do
      event_id = "evt_unknown_customer_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "checkout.session.completed",
        "data" => %{
          "object" => %{
            "customer" => "cus_not_in_db",
            "subscription" => "sub_whatever"
          }
        }
      }

      assert {:ok, {:skipped, :customer_not_found}} = Billing.handle_event(event)
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

    test "is idempotent by stripe_event_id", %{user: user, plan: plan} do
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
    end
  end
end
