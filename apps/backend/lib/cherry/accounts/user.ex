defmodule Cherry.Accounts.User do
  use Ecto.Schema

  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field(:email, :string)
    field(:display_name, :string)
    field(:deleted_at, :utc_datetime)
    # A moderation restriction is not account deletion: rights and appeals stay available.
    field(:suspended_at, :utc_datetime)
    field(:suspension_case_id, :binary_id)
    # System-owned only: never accepted from a profile/auth form.
    field(:legal_policy_fingerprint, :string)

    # Legacy soft-deletion marker; new account deletion physically removes the row.
    field(:deletion_reason, :string)

    timestamps(type: :utc_datetime)
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:email, :display_name])
    |> validate_required([:email])
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:email)
  end
end
