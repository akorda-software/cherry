defmodule Snack.Billing.ProcessedEvent do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "billing_processed_events" do
    field(:event_id, :string)
    field(:event_type, :string)

    timestamps(type: :utc_datetime)
  end

  def changeset(processed_event, attrs) do
    processed_event
    |> cast(attrs, [:event_id, :event_type])
    |> validate_required([:event_id])
    |> unique_constraint(:event_id)
  end
end
