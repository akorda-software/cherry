defmodule Cherry.Accounts.ErasureTask do
  @moduledoc "Temporary external deletion instructions; no account, email or document fingerprint."
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  schema "erasure_tasks" do
    field(:kind, :string)
    field(:reference, :string, redact: true)
    field(:not_before, :utc_datetime)
    field(:finalize_after, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end
end
