defmodule Snack.Dating.DiscoveryPreference do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @unlimited_distance_km 999_999
  @distance_options [10, 25, 50, 100, @unlimited_distance_km]
  @min_age 18
  @max_age 100

  schema "discovery_preferences" do
    field(:age_min, :integer)
    field(:age_max, :integer)
    field(:distance_km, :integer)
    field(:show_men, :boolean, default: false)
    field(:show_women, :boolean, default: false)
    field(:show_non_binary, :boolean, default: false)
    field(:compatible_only, :boolean, default: false)
    # Adds a second, always-later distance tier when the preferred radius runs dry.
    field(:expand_distance, :boolean, default: true)
    field(:discovery_mode, Ecto.Enum, values: [:swipe, :feed], default: :feed)

    belongs_to(:profile, Profile)

    timestamps(type: :utc_datetime)
  end

  @doc "Allowed `distance_km` values; #{@unlimited_distance_km} means no distance limit."
  def distance_options, do: @distance_options

  def unlimited_distance_km, do: @unlimited_distance_km

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
      :expand_distance,
      :discovery_mode
    ])
    |> validate_required([:age_min, :age_max, :distance_km])
    |> validate_number(:age_min,
      greater_than_or_equal_to: @min_age,
      less_than_or_equal_to: @max_age
    )
    |> validate_number(:age_max,
      greater_than_or_equal_to: @min_age,
      less_than_or_equal_to: @max_age
    )
    |> validate_inclusion(:distance_km, @distance_options,
      message: "must be one of 10, 25, 50, 100 or 999999 (no limit)"
    )
    |> validate_age_range()
    |> validate_at_least_one_interested_in()
    |> foreign_key_constraint(:profile_id)
  end

  defp validate_age_range(changeset) do
    age_min = get_field(changeset, :age_min)
    age_max = get_field(changeset, :age_max)

    if is_integer(age_min) and is_integer(age_max) and age_min > age_max do
      add_error(changeset, :age_max, "must be greater than or equal to age_min")
    else
      changeset
    end
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
