defmodule Snack.Repo.Migrations.CreateBillingSubscriptions do
  use Ecto.Migration

  def change do
    create table(:billing_subscriptions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:stripe_subscription_id, :string, null: false)
      add(:stripe_event_id, :string, null: false)
      add(:status, :string, default: "pending", null: false)
      add(:current_period_end, :utc_datetime)
      add(:cancel_at_period_end, :boolean, default: false, null: false)

      add(
        :customer_id,
        references(:billing_customers, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:plan_id, references(:billing_plans, type: :binary_id, on_delete: :nothing),
        null: false
      )

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:billing_subscriptions, [:stripe_event_id]))
    create(index(:billing_subscriptions, [:customer_id]))
    create(index(:billing_subscriptions, [:plan_id]))
  end
end
