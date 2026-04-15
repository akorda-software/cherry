defmodule Snack.Identity.ProviderIdentity do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Accounts.User

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "provider_identities" do
    field(:provider, :string)
    field(:provider_subject, :string)
    field(:provider_email, :string)
    field(:provider_data, :map, default: %{})

    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  def changeset(identity, attrs) do
    identity
    |> cast(attrs, [:provider, :provider_subject, :provider_email, :provider_data])
    |> validate_required([:provider, :provider_subject, :provider_data])
    |> put_assoc(:user, Map.fetch!(attrs, :user))
    |> unique_constraint([:provider, :provider_subject])
  end
end
