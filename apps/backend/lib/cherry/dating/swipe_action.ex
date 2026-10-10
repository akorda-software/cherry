defmodule Cherry.Dating.SwipeAction do
  use Ecto.Schema

  import Ecto.Changeset

  alias Cherry.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "swipe_actions" do
    field(:action_type, :string)

    belongs_to(:actor_profile, Profile, foreign_key: :actor_profile_id)
    belongs_to(:target_profile, Profile, foreign_key: :target_profile_id)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(action, attrs) do
    action
    |> cast(attrs, [:action_type, :actor_profile_id, :target_profile_id])
    |> validate_required([:action_type, :actor_profile_id, :target_profile_id])
    |> validate_inclusion(:action_type, ["like", "dislike"])
    |> validate_different_profiles()
    |> unique_constraint([:actor_profile_id, :target_profile_id])
    |> foreign_key_constraint(:actor_profile_id)
    |> foreign_key_constraint(:target_profile_id)
  end

  defp validate_different_profiles(changeset) do
    actor = get_field(changeset, :actor_profile_id)
    target = get_field(changeset, :target_profile_id)

    if actor && target && actor == target do
      add_error(changeset, :target_profile_id, "cannot swipe yourself")
    else
      changeset
    end
  end
end
