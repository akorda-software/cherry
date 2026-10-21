defmodule Cherry.Repo.Migrations.CreateVerificationProviderUsage do
  use Ecto.Migration

  # Didit sessions started per calendar month (UTC), for the monthly limit
  # (DIDIT_MONTHLY_LIMIT). Only counts: no user, session or document.
  def change do
    create table(:verification_provider_usage, primary_key: false) do
      add(:month, :date, primary_key: true)
      add(:sessions, :integer, null: false, default: 0)
      timestamps(type: :utc_datetime)
    end
  end
end
