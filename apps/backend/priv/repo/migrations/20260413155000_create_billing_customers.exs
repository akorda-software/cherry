defmodule Snack.Repo.Migrations.CreateBillingCustomers do
  use Ecto.Migration

  def change do
    create table(:billing_customers, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:stripe_customer_id, :string, null: false)
      add(:email, :string, null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:billing_customers, [:stripe_customer_id]))
    create(index(:billing_customers, [:user_id]))
  end
end
