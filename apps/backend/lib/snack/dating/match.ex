defmodule Snack.Dating.Match do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile
  alias Snack.Dating.Conversation

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "matches" do
    field(:status, :string, default: "active")
    field(:matched_at, :utc_datetime)
    field(:expires_at, :utc_datetime)
    field(:first_message_at, :utc_datetime)
    field(:unmatched_at, :utc_datetime)

    belongs_to(:profile_a, Profile, foreign_key: :profile_a_id)
    belongs_to(:profile_b, Profile, foreign_key: :profile_b_id)
    has_one(:conversation, Conversation)

    timestamps(type: :utc_datetime)
  end

  def changeset(match, attrs) do
    match
    |> cast(attrs, [
      :status,
      :matched_at,
      :expires_at,
      :first_message_at,
      :unmatched_at,
      :profile_a_id,
      :profile_b_id
    ])
    |> validate_required([:status, :matched_at, :profile_a_id, :profile_b_id])
    |> validate_inclusion(:status, ["active", "expired", "unmatched"])
    |> validate_different_profiles()
    |> foreign_key_constraint(:profile_a_id)
    |> foreign_key_constraint(:profile_b_id)
  end

  defp validate_different_profiles(changeset) do
    a = get_field(changeset, :profile_a_id)
    b = get_field(changeset, :profile_b_id)

    if a && b && a == b do
      add_error(changeset, :profile_b_id, "cannot match with yourself")
    else
      changeset
    end
  end

  def other_profile(%__MODULE__{profile_a_id: a_id, profile_b_id: b_id}, profile_id)
      when a_id == profile_id,
      do: b_id

  def other_profile(%__MODULE__{profile_a_id: a_id, profile_b_id: b_id}, profile_id)
      when b_id == profile_id,
      do: a_id

  def other_profile(_, _), do: nil
end
