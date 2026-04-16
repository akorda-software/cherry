defmodule Snack.Billing.Subscription do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "billing_subscriptions" do
    field(:stripe_subscription_id, :string)
    field(:stripe_event_id, :string)
    field(:status, :string, default: "pending")
    field(:current_period_end, :utc_datetime)
    field(:cancel_at_period_end, :boolean, default: false)

    belongs_to(:customer, Snack.Billing.Customer)
    belongs_to(:plan, Snack.Billing.Plan)

    timestamps(type: :utc_datetime)
  end

  def changeset(subscription, attrs) do
    subscription
    |> cast(attrs, [
      :stripe_subscription_id,
      :stripe_event_id,
      :status,
      :current_period_end,
      :cancel_at_period_end,
      :customer_id,
      :plan_id
    ])
    |> validate_required([:stripe_subscription_id, :stripe_event_id, :customer_id, :plan_id])
    |> unique_constraint(:stripe_subscription_id)
  end
end
