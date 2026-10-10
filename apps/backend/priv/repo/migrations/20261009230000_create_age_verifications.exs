defmodule Cherry.Repo.Migrations.CreateAgeVerifications do
  @moduledoc """
  Age verification (D-2026-10-09, docs/compliance/02-mayoria-de-edad.md).

  `age_verifications` keeps only "adult: yes" for a user: status, method, date
  and the keyed fingerprint of the document (unique: one document, one
  account). Nothing read from the document is stored.

  `age_verification_attempts` only has timestamps, for the per-user attempt
  limit; no result or document data.
  """
  use Ecto.Migration

  def change do
    create table(:age_verifications, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:status, :string, null: false)
      add(:method, :string, null: false)
      add(:verified_at, :utc_datetime, null: false)
      add(:document_fingerprint, :binary)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:age_verifications, [:user_id]))
    create(unique_index(:age_verifications, [:document_fingerprint]))

    create(
      constraint(:age_verifications, :status_valid, check: "status IN ('verified', 'revoked')")
    )

    create(
      constraint(:age_verifications, :method_valid,
        check: "method IN ('nfc_dni', 'nfc_passport', 'provider', 'eu_wallet')"
      )
    )

    create table(:age_verification_attempts, primary_key: false) do
      add(:id, :bigserial, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:inserted_at, :utc_datetime, null: false)
    end

    create(index(:age_verification_attempts, [:user_id, :inserted_at]))
  end
end
