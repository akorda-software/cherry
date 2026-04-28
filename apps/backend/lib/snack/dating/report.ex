defmodule Snack.Dating.Report do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User
  alias Snack.Dating.Profile

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "reports" do
    field(:reason, :string)
    field(:details, :string)
    field(:status, :string, default: "open")
    field(:reviewed_at, :utc_datetime)

    belongs_to(:reporter_profile, Profile, foreign_key: :reporter_profile_id)
    belongs_to(:target_profile, Profile, foreign_key: :target_profile_id)
    belongs_to(:reviewed_by_user, User, foreign_key: :reviewed_by_user_id)

    timestamps(type: :utc_datetime)
  end

  def changeset(report, attrs) do
    report
    |> cast(attrs, [
      :reason,
      :details,
      :status,
      :reviewed_at,
      :reporter_profile_id,
      :target_profile_id,
      :reviewed_by_user_id
    ])
    |> validate_required([:reason, :reporter_profile_id, :target_profile_id])
    |> validate_inclusion(:status, ["open", "reviewed", "dismissed", "actioned"])
    |> validate_different_profiles()
    |> foreign_key_constraint(:reporter_profile_id)
    |> foreign_key_constraint(:target_profile_id)
    |> foreign_key_constraint(:reviewed_by_user_id)
  end

  defp validate_different_profiles(changeset) do
    reporter = get_field(changeset, :reporter_profile_id)
    target = get_field(changeset, :target_profile_id)

    if reporter && target && reporter == target do
      add_error(changeset, :target_profile_id, "cannot report yourself")
    else
      changeset
    end
  end
end
