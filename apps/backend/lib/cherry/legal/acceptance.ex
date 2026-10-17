defmodule Cherry.Legal.Acceptance do
  @moduledoc "Minimal account-bound proof; no IP, device fingerprint or OAuth credential."
  use Ecto.Schema
  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "legal_acceptances" do
    field(:user_id, :binary_id)
    field(:version, :string)
    field(:fingerprint, :string)
    field(:snapshot, :map)
    field(:terms_accepted_at, :utc_datetime)
    field(:sensitive_consented_at, :utc_datetime)
    field(:adulthood_confirmed_at, :utc_datetime)
  end
end
