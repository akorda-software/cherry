defmodule Snack.Dating.ProfileLocation do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile

  @primary_key false
  @foreign_key_type :binary_id

  schema "profile_locations" do
    belongs_to(:profile, Profile, primary_key: true)
    field(:coordinates, Geo.PostGIS.Geometry)
    field(:accuracy_meters, :integer)
    field(:recorded_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(location, attrs) do
    location
    |> cast(attrs, [:coordinates, :accuracy_meters, :recorded_at])
    |> validate_required([:coordinates, :recorded_at])
    |> foreign_key_constraint(:profile_id)
  end
end
