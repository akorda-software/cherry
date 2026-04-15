defmodule Snack.Billing.Customer do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "billing_customers" do
    field(:user_id, :binary_id)
    field(:stripe_customer_id, :string)
    field(:email, :string)

    timestamps(type: :utc_datetime)
  end

  def changeset(customer, attrs) do
    customer
    |> cast(attrs, [:user_id, :stripe_customer_id, :email])
    |> validate_required([:user_id, :stripe_customer_id, :email])
    |> unique_constraint(:stripe_customer_id)
  end
end
