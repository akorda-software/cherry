defmodule Snack.Repo.Migrations.AddStripeSubscriptionUniqueIndex do
  use Ecto.Migration

  def change do
    create(unique_index(:billing_subscriptions, [:stripe_subscription_id]))
  end
end
