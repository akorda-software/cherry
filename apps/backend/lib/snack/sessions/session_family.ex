defmodule Snack.Sessions.SessionFamily do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User
  alias Snack.Sessions.Device

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "session_families" do
    field(:revoked_at, :utc_datetime)

    belongs_to(:user, User)
    belongs_to(:device, Device)

    timestamps(type: :utc_datetime)
  end

  def changeset(session_family, attrs) do
    session_family
    |> cast(attrs, [:revoked_at])
    |> put_assoc(:user, Map.fetch!(attrs, :user))
    |> put_assoc(:device, Map.fetch!(attrs, :device))
  end
end
