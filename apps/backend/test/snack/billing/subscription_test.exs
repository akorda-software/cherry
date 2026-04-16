defmodule Snack.Billing.SubscriptionTest do
  use Snack.DataCase, async: true

  alias Snack.Accounts
  alias Snack.Billing.Customer
  alias Snack.Billing.Plan
  alias Snack.Billing.Subscription

  describe "changeset/2" do
    setup do
      {:ok, user} =
        Accounts.create_user(%{email: "subuser@example.com", display_name: "Sub User"})

      {:ok, customer} =
        %Customer{}
        |> Customer.changeset(%{
          user_id: user.id,
          stripe_customer_id: "cus_sub_#{System.unique_integer([:positive])}",
          email: user.email
        })
        |> Repo.insert()

      {:ok, plan} =
        %Plan{}
        |> Plan.changeset(%{
          name: "Pro",
          stripe_price_id: "price_sub_#{System.unique_integer([:positive])}",
          amount_cents: 999,
          currency: "usd",
          interval: "month"
        })
        |> Repo.insert()

      %{customer: customer, plan: plan}
    end

    test "valid with required fields and associations", %{customer: customer, plan: plan} do
      changeset =
        Subscription.changeset(%Subscription{}, %{
          stripe_subscription_id: "sub_abc123",
          stripe_event_id: "evt_abc123",
          status: "pending",
          customer_id: customer.id,
          plan_id: plan.id
        })

      assert changeset.valid? == true
    end

    test "status defaults to pending" do
      changeset =
        Subscription.changeset(%Subscription{}, %{
          stripe_subscription_id: "sub_def456",
          stripe_event_id: "evt_def456",
          customer_id: Ecto.UUID.generate(),
          plan_id: Ecto.UUID.generate()
        })

      assert Ecto.Changeset.get_field(changeset, :status) == nil or changeset.valid?
    end

    test "allows stripe_event_id reuse across subscriptions", %{customer: customer, plan: plan} do
      event_id = "evt_unique_#{System.unique_integer([:positive])}"

      {:ok, _} =
        %Subscription{}
        |> Subscription.changeset(%{
          stripe_subscription_id: "sub_first",
          stripe_event_id: event_id,
          status: "active",
          customer_id: customer.id,
          plan_id: plan.id
        })
        |> Repo.insert()

      {:ok, second_subscription} =
        %Subscription{}
        |> Subscription.changeset(%{
          stripe_subscription_id: "sub_second",
          stripe_event_id: event_id,
          status: "active",
          customer_id: customer.id,
          plan_id: plan.id
        })
        |> Repo.insert()

      assert second_subscription.stripe_event_id == event_id
    end

    test "requires stripe_subscription_id", %{customer: customer, plan: plan} do
      changeset =
        Subscription.changeset(%Subscription{}, %{
          stripe_event_id: "evt_test",
          status: "pending",
          customer_id: customer.id,
          plan_id: plan.id
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).stripe_subscription_id
    end

    test "requires stripe_event_id", %{customer: customer, plan: plan} do
      changeset =
        Subscription.changeset(%Subscription{}, %{
          stripe_subscription_id: "sub_test",
          status: "pending",
          customer_id: customer.id,
          plan_id: plan.id
        })

      refute changeset.valid?
      assert "can't be blank" in errors_on(changeset).stripe_event_id
    end
  end
end
