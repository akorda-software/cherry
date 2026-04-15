defmodule Snack.Billing.Plan do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "billing_plans" do
    field(:name, :string)
    field(:stripe_price_id, :string)
    field(:amount_cents, :integer)
    field(:currency, :string)
    field(:interval, :string)

    timestamps(type: :utc_datetime)
  end

  def changeset(plan, attrs) do
    plan
    |> cast(attrs, [:name, :stripe_price_id, :amount_cents, :currency, :interval])
    |> validate_required([:name, :stripe_price_id, :amount_cents, :currency, :interval])
    |> unique_constraint(:stripe_price_id)
  end
end
