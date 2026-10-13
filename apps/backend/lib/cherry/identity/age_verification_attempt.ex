defmodule Cherry.Identity.AgeVerificationAttempt do
  @moduledoc "When a user sent a document for verification (for the attempt limit). Nothing else."
  use Ecto.Schema

  @foreign_key_type :binary_id

  schema "age_verification_attempts" do
    belongs_to(:user, Cherry.Accounts.User)
    field(:inserted_at, :utc_datetime)
  end
end
