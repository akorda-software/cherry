defmodule Snack.Dating.UserBlock do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "user_blocks" do
    field(:reason, :string)

    belongs_to(:actor_profile, Profile, foreign_key: :actor_profile_id)
    belongs_to(:target_profile, Profile, foreign_key: :target_profile_id)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(block, attrs) do
    block
    |> cast(attrs, [:reason, :actor_profile_id, :target_profile_id])
    |> validate_required([:actor_profile_id, :target_profile_id])
    |> validate_different_profiles()
    |> unique_constraint([:actor_profile_id, :target_profile_id])
    |> foreign_key_constraint(:actor_profile_id)
    |> foreign_key_constraint(:target_profile_id)
  end

  defp validate_different_profiles(changeset) do
    actor = get_field(changeset, :actor_profile_id)
    target = get_field(changeset, :target_profile_id)

    if actor && target && actor == target do
      add_error(changeset, :target_profile_id, "cannot block yourself")
    else
      changeset
    end
  end
end
