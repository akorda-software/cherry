defmodule Cherry.Backoffice.Credential do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  schema "backoffice_credentials" do
    field(:staff_id, :binary_id)
    field(:token_hash, :binary, redact: true)
    field(:kind, :string)
    field(:expires_at, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end
end
