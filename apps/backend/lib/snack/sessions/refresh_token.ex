defmodule Snack.Sessions.RefreshToken do
  use Ecto.Schema

  import Ecto.Changeset

  alias Snack.Sessions.SessionFamily

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "refresh_tokens" do
    field(:token_hash, :string)
    field(:status, :string)
    field(:expires_at, :utc_datetime)
    field(:rotated_at, :utc_datetime)
    field(:revoked_at, :utc_datetime)

    belongs_to(:session_family, SessionFamily)
    belongs_to(:parent_token, __MODULE__)

    timestamps(type: :utc_datetime)
  end

  def changeset(refresh_token, attrs) do
    refresh_token
    |> cast(attrs, [:token_hash, :status, :expires_at, :rotated_at, :revoked_at])
    |> validate_required([:token_hash, :status, :expires_at])
    |> put_assoc(:session_family, Map.fetch!(attrs, :session_family))
    |> maybe_put_parent(attrs)
    |> unique_constraint(:token_hash)
  end

  defp maybe_put_parent(changeset, %{parent_token: parent_token}) do
    put_assoc(changeset, :parent_token, parent_token)
  end

  defp maybe_put_parent(changeset, _attrs), do: changeset
end
