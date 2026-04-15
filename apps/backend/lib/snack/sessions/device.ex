defmodule Snack.Sessions.Device do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "devices" do
    field(:installation_id, :string)
    field(:platform, :string)
    field(:device_name, :string)
    field(:last_seen_at, :utc_datetime)

    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  def changeset(device, attrs) do
    device
    |> cast(attrs, [:installation_id, :platform, :device_name, :last_seen_at])
    |> validate_required([:installation_id, :platform, :device_name, :last_seen_at])
    |> put_assoc(:user, Map.fetch!(attrs, :user))
    |> unique_constraint([:user_id, :installation_id])
  end
end
