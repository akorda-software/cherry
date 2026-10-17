defmodule Cherry.Casework.Notice do
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "casework_notices" do
    field(:case_id, :binary_id)
    field(:user_id, :binary_id)
    field(:message, :string, redact: true)
    field(:event, :string)
    field(:read_at, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end
end
