defmodule Snack.Repo.Migrations.CreateBillingProcessedEvents do
  use Ecto.Migration

  def change do
    drop_if_exists(unique_index(:billing_subscriptions, [:stripe_event_id]))

    create table(:billing_processed_events, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:event_id, :string, null: false)
      add(:event_type, :string)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:billing_processed_events, [:event_id]))
  end
end
