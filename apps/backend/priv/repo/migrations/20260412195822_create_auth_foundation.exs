defmodule Snack.Repo.Migrations.CreateAuthFoundation do
  use Ecto.Migration

  def change do
    execute("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\"", "")

    create table(:users, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:email, :string, null: false)
      add(:display_name, :string)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:users, [:email]))

    create table(:provider_identities, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:provider, :string, null: false)
      add(:provider_subject, :string, null: false)
      add(:provider_email, :string)
      add(:provider_data, :map, null: false, default: %{})
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:provider_identities, [:provider, :provider_subject]))

    create table(:devices, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:installation_id, :string, null: false)
      add(:platform, :string, null: false)
      add(:device_name, :string, null: false)
      add(:last_seen_at, :utc_datetime, null: false)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:devices, [:user_id, :installation_id]))

    create table(:session_families, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:revoked_at, :utc_datetime)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:device_id, references(:devices, type: :binary_id, on_delete: :delete_all), null: false)

      timestamps(type: :utc_datetime)
    end

    create table(:refresh_tokens, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:token_hash, :string, null: false)
      add(:status, :string, null: false)
      add(:expires_at, :utc_datetime, null: false)
      add(:rotated_at, :utc_datetime)
      add(:revoked_at, :utc_datetime)

      add(
        :session_family_id,
        references(:session_families, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:parent_token_id, references(:refresh_tokens, type: :binary_id, on_delete: :nilify_all))

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:refresh_tokens, [:token_hash]))
    create(index(:refresh_tokens, [:session_family_id]))
  end
end
