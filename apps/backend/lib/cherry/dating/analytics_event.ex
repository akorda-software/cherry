defmodule Cherry.Dating.AnalyticsEvent do
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Accounts.User
  alias Cherry.Dating.Profile

  @primary_key {:id, :id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "analytics_events" do
    field(:event_name, :string)
    field(:payload, :map, default: %{})

    belongs_to(:user, User)
    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:event_name, :payload, :user_id, :profile_id])
    |> validate_required([:event_name])
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:profile_id)
  end
end
