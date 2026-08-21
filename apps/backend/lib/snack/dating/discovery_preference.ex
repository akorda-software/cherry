defmodule Snack.Dating.DiscoveryPreference do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "discovery_preferences" do
    field(:age_min, :integer)
    field(:age_max, :integer)
    field(:distance_km, :integer)
    field(:show_men, :boolean, default: false)
    field(:show_women, :boolean, default: false)
    field(:show_non_binary, :boolean, default: false)
    field(:compatible_only, :boolean, default: false)
    field(:discovery_mode, Ecto.Enum, values: [:swipe, :feed], default: :feed)

    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime)
  end

  def changeset(preference, attrs) do
    preference
    |> cast(attrs, [
      :age_min,
      :age_max,
      :distance_km,
      :show_men,
      :show_women,
      :show_non_binary,
      :compatible_only,
      :discovery_mode
    ])
    |> validate_required([:age_min, :age_max, :distance_km])
    |> validate_number(:age_min, greater_than_or_equal_to: 18, less_than_or_equal_to: 100)
    |> validate_number(:age_max, greater_than_or_equal_to: 18, less_than_or_equal_to: 100)
    |> validate_number(:distance_km, greater_than: 0)
    |> validate_at_least_one_interested_in()
    |> foreign_key_constraint(:profile_id)
  end

  defp validate_at_least_one_interested_in(changeset) do
    show_men = get_field(changeset, :show_men, false)
    show_women = get_field(changeset, :show_women, false)
    show_non_binary = get_field(changeset, :show_non_binary, false)

    if show_men || show_women || show_non_binary do
      changeset
    else
      add_error(changeset, :show_men, "select at least one option")
    end
  end
end
