defmodule Cherry.Identity.ProviderSession do
  @moduledoc false
  use Ecto.Schema
  @primary_key {:id, :string, autogenerate: false}
  schema "verification_provider_sessions" do
    field(:user_id, :binary_id)
    timestamps(type: :utc_datetime, updated_at: false)
  end
end
