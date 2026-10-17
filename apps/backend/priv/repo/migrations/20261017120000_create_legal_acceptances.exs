defmodule Cherry.Repo.Migrations.CreateLegalAcceptances do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add(:legal_policy_fingerprint, :string, size: 64)
    end

    create table(:legal_acceptances, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:version, :string, null: false)
      add(:fingerprint, :string, size: 64, null: false)
      add(:snapshot, :map, null: false)
      add(:terms_accepted_at, :utc_datetime, null: false)
      add(:sensitive_consented_at, :utc_datetime, null: false)
      add(:adulthood_confirmed_at, :utc_datetime, null: false)
    end

    create(unique_index(:legal_acceptances, [:user_id, :fingerprint]))
  end
end
