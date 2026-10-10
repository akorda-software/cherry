defmodule Cherry.Dating.ProfilePhoto do
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "profile_photos" do
    field(:storage_key, :string)
    field(:url, :string)
    field(:position, :integer)
    field(:is_active, :boolean, default: true)

    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime)
  end

  def changeset(photo, attrs) do
    photo
    |> cast(attrs, [:profile_id, :storage_key, :url, :position, :is_active])
    |> validate_required([:profile_id, :storage_key, :url, :position])
    |> validate_number(:position, greater_than_or_equal_to: 1, less_than_or_equal_to: 4)
    |> foreign_key_constraint(:profile_id)
  end
end
