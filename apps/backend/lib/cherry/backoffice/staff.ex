defmodule Cherry.Backoffice.Staff do
  use Ecto.Schema
  import Ecto.Changeset
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "backoffice_staff" do
    field(:email, :string)
    field(:role, :string)
    field(:disabled_at, :utc_datetime)
    field(:password_hash, :string, redact: true)
    field(:failed_login_attempts, :integer, default: 0)
    field(:login_blocked_until, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(staff, attrs) do
    staff
    |> cast(attrs, [:email, :role, :disabled_at])
    |> update_change(:email, &(String.trim(&1) |> String.downcase()))
    |> validate_required([:email, :role])
    |> validate_format(:email, ~r/^[^\s@]+@[^\s@]+$/)
    |> validate_length(:email, max: 254)
    |> validate_inclusion(:role, ~w(superadmin admin moderator privacy))
    |> unique_constraint(:email)
  end
end
