defmodule Cherry.Repo.Migrations.CreatePushTokens do
  use Ecto.Migration

  def change do
    create table(:push_tokens, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:expo_push_token, :text, null: false)
      add(:platform, :string, null: false)
      add(:installation_id, :string, null: false)
      add(:status, :string, null: false, default: "active")
      add(:last_seen_at, :utc_datetime, null: false)
      add(:disabled_at, :utc_datetime)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:device_id, references(:devices, type: :binary_id, on_delete: :delete_all), null: false)

      add(
        :session_family_id,
        references(:session_families, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:push_tokens, [:session_family_id]))
    create(index(:push_tokens, [:user_id]))
    create(index(:push_tokens, [:device_id]))
    create(index(:push_tokens, [:expo_push_token]))
    create(index(:push_tokens, [:status]))
  end
end
