defmodule Snack.Repo.Migrations.CreateBillingPlans do
  use Ecto.Migration

  def change do
    create table(:billing_plans, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:name, :string, null: false)
      add(:stripe_price_id, :string, null: false)
      add(:amount_cents, :integer, null: false)
      add(:currency, :string, null: false)
      add(:interval, :string, null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:billing_plans, [:stripe_price_id]))
  end
end
