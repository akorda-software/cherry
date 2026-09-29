defmodule Snack.Dating.Profile do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User
  alias Snack.Dating.DiscoveryPreference
  alias Snack.Dating.ProfilePhoto
  alias Snack.Dating.ProfileLocation

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @genders ["man", "woman", "non_binary"]
  @relationship_intents ["relationship", "casual", "meet_people", "go_with_the_flow"]

  schema "profiles" do
    field(:display_name, :string)
    field(:birth_date, :date)
    field(:gender, :string)
    field(:what_i_am_looking_for, :string)
    field(:bio, :string)
    field(:is_complete, :boolean, default: false)
    field(:is_paused, :boolean, default: false)
    field(:is_discoverable, :boolean, default: false)
    field(:deleted_at, :utc_datetime)
    # Discovery ranking v2: newcomer boost and real activity (D-2026-09-29).
    field(:completed_at, :utc_datetime)
    field(:last_active_at, :utc_datetime)

    belongs_to(:user, User)
    has_one(:discovery_preference, DiscoveryPreference)
    has_many(:photos, ProfilePhoto)
    has_one(:location, ProfileLocation)
    many_to_many(:tags, Snack.Dating.Tag, join_through: "profile_tags", on_replace: :delete)

    many_to_many(:blocked_tags, Snack.Dating.Tag,
      join_through: "profile_blocked_tags",
      on_replace: :delete
    )

    timestamps(type: :utc_datetime)
  end

  def changeset(profile, attrs) do
    profile
    |> cast(attrs, [
      :user_id,
      :display_name,
      :birth_date,
      :gender,
      :what_i_am_looking_for,
      :bio,
      :is_complete,
      :is_paused,
      :is_discoverable,
      :deleted_at
    ])
    |> validate_required([
      :user_id,
      :display_name,
      :birth_date,
      :gender,
      :what_i_am_looking_for,
      :bio
    ])
    |> validate_profile_fields()
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id)
  end

  def draft_changeset(profile, attrs) do
    profile
    |> cast(attrs, [:user_id, :display_name, :birth_date, :gender, :what_i_am_looking_for, :bio])
    |> validate_required([:user_id])
    |> validate_profile_fields()
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id)
  end

  def system_changeset(profile, attrs) do
    cast(profile, attrs, [:is_complete, :is_paused, :is_discoverable, :deleted_at, :completed_at])
  end

  defp validate_profile_fields(changeset) do
    changeset
    |> validate_length(:display_name, min: 1, max: 50)
    |> validate_length(:bio, min: 20, max: 240)
    |> validate_inclusion(:gender, @genders)
    |> validate_inclusion(:what_i_am_looking_for, @relationship_intents)
  end

  def genders, do: @genders

  def relationship_intents, do: @relationship_intents

  def age(%{birth_date: nil}), do: nil

  def age(%{birth_date: %Date{} = birth_date}) do
    today = Date.utc_today()
    years = today.year - birth_date.year

    if Date.compare(today, %{birth_date | year: today.year}) == :lt do
      years - 1
    else
      years
    end
  end
end
