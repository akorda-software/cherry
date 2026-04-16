defmodule Snack.Billing.WebhookProcessorTest do
  use Snack.DataCase, async: true

  alias Snack.Accounts
  alias Snack.Billing
  alias Snack.Billing.Customer
  alias Snack.Billing.Plan
  alias Snack.Billing.Subscription
  alias Snack.Billing.WebhookProcessor

  setup do
    Application.put_env(:snack, :stripe_client, Snack.Billing.MockStripeClient)

    {:ok, user} =
      Accounts.create_user(%{email: "webhook_test@example.com", display_name: "Webhook Tester"})

    {:ok, plan} =
      %Plan{}
      |> Plan.changeset(%{
        name: "Pro",
        stripe_price_id: "price_webhook_test",
        amount_cents: 999,
        currency: "usd",
        interval: "month"
      })
      |> Repo.insert()

    %{user: user, plan: plan}
  end

  describe "process/1" do
    test "deduplicates by processed event id", %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      real_stripe_sub_id = "sub_dedup_#{System.unique_integer([:positive])}"

      sub
      |> Subscription.changeset(%{
        stripe_subscription_id: real_stripe_sub_id,
        stripe_event_id: "evt_dedup_promote_#{System.unique_integer([:positive])}",
        status: "active"
      })
      |> Repo.update!()

      event_id = "evt_dedup_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.updated",
        "data" => %{"object" => %{"id" => real_stripe_sub_id, "status" => "active"}}
      }

      assert {:ok, _} = WebhookProcessor.process(event)
      assert {:ok, :already_processed} = WebhookProcessor.process(event)
    end

    test "promotes pending sub to active on customer.subscription.updated",
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

      assert {:ok, updated} = WebhookProcessor.process(event)
      assert updated.status == "active"
      assert updated.stripe_subscription_id == real_stripe_sub_id
    end

    test "processes customer.subscription.deleted event", %{user: user, plan: plan} do
      {:ok, _} = Billing.subscribe(user, plan.id)

      customer = Repo.get_by(Customer, user_id: user.id)

      sub =
        Repo.one(from(s in Subscription, where: s.customer_id == ^customer.id, limit: 1))

      real_stripe_sub_id = "sub_deleted_#{System.unique_integer([:positive])}"

      sub
      |> Subscription.changeset(%{
        stripe_subscription_id: real_stripe_sub_id,
        stripe_event_id: "evt_deleted_promote_#{System.unique_integer([:positive])}",
        status: "active"
      })
      |> Repo.update!()

      event_id = "evt_deleted_#{System.unique_integer([:positive])}"

      event = %{
        "id" => event_id,
        "type" => "customer.subscription.deleted",
        "data" => %{"object" => %{"id" => real_stripe_sub_id, "status" => "canceled"}}
      }

      assert {:ok, updated} = WebhookProcessor.process(event)
      assert updated.status == "canceled"
    end

    test "returns ok for unknown event types" do
      event = %{
        "id" => "evt_unknown_#{System.unique_integer([:positive])}",
        "type" => "unknown.event.type",
        "data" => %{"object" => %{}}
      }

      assert {:ok, :unhandled_event_type} = WebhookProcessor.process(event)
    end
  end
end
