defmodule Snack.Repo.Migrations.CreateDatingFoundation do
  use Ecto.Migration

  def change do
    execute("CREATE EXTENSION IF NOT EXISTS postgis", "")
    execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"", "")

    create table(:tags, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:slug, :string, null: false)
      add(:label, :string, null: false)
      add(:category, :string, null: false)
      add(:is_active, :boolean, null: false, default: true)
      add(:sort_order, :integer, null: false, default: 0)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:tags, [:slug]))
    create(index(:tags, [:category]))

    create table(:profiles, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false)
      add(:display_name, :string, null: false)
      add(:birth_date, :date, null: false)
      add(:gender, :string, null: false)
      add(:what_i_am_looking_for, :string, null: false)
      add(:bio, :text, null: false)
      add(:is_complete, :boolean, null: false, default: false)
      add(:is_paused, :boolean, null: false, default: false)
      add(:is_discoverable, :boolean, null: false, default: false)
      add(:deleted_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:profiles, [:user_id]))
    create(index(:profiles, [:gender]))
    create(index(:profiles, [:what_i_am_looking_for]))
    create(index(:profiles, [:is_complete, :is_discoverable, :deleted_at]))

    create table(:discovery_preferences, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:age_min, :integer, null: false)
      add(:age_max, :integer, null: false)
      add(:distance_km, :integer, null: false)
      add(:show_men, :boolean, null: false, default: false)
      add(:show_women, :boolean, null: false, default: false)
      add(:show_non_binary, :boolean, null: false, default: false)
      add(:compatible_only, :boolean, null: false, default: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:discovery_preferences, [:profile_id]))

    create table(:profile_photos, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:storage_key, :string, null: false)
      add(:url, :string, null: false)
      add(:position, :integer, null: false)
      add(:is_active, :boolean, null: false, default: true)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:profile_photos, [:profile_id, :position], where: "is_active = true"))
    create(index(:profile_photos, [:profile_id]))

    create table(:profile_tags, primary_key: false) do
      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:tag_id, references(:tags, type: :binary_id, on_delete: :delete_all), null: false)
      add(:inserted_at, :utc_datetime, null: false, default: fragment("now()"))
    end

    create(unique_index(:profile_tags, [:profile_id, :tag_id]))
    create(index(:profile_tags, [:tag_id]))

    create table(:profile_blocked_tags, primary_key: false) do
      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:tag_id, references(:tags, type: :binary_id, on_delete: :delete_all), null: false)
      add(:inserted_at, :utc_datetime, null: false, default: fragment("now()"))
    end

    create(unique_index(:profile_blocked_tags, [:profile_id, :tag_id]))
    create(index(:profile_blocked_tags, [:tag_id]))

    create table(:profile_locations, primary_key: false) do
      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false,
        primary_key: true
      )

      add(:coordinates, :geography, null: false)
      add(:accuracy_meters, :integer)
      add(:recorded_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    execute(
      "CREATE INDEX idx_profile_locations_coordinates ON profile_locations USING GIST (coordinates)"
    )

    create(index(:profile_locations, [:recorded_at]))

    create table(:swipe_actions, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:actor_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:target_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:action_type, :string, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:swipe_actions, [:actor_profile_id, :target_profile_id]))
    create(index(:swipe_actions, [:target_profile_id]))

    create table(:matches, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:profile_a_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:profile_b_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:status, :string, null: false, default: "active")
      add(:matched_at, :utc_datetime, null: false)
      add(:expires_at, :utc_datetime)
      add(:first_message_at, :utc_datetime)
      add(:unmatched_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    execute(
      "CREATE UNIQUE INDEX idx_matches_canonical_pair ON matches (LEAST(profile_a_id, profile_b_id), GREATEST(profile_a_id, profile_b_id))"
    )

    create(index(:matches, [:profile_a_id]))
    create(index(:matches, [:profile_b_id]))
    create(index(:matches, [:status, :expires_at]))

    create table(:conversations, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:match_id, references(:matches, type: :binary_id, on_delete: :delete_all), null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:conversations, [:match_id]))

    create table(:messages, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:conversation_id, references(:conversations, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:sender_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:body, :text, null: false)

      timestamps(type: :utc_datetime)
    end

    create(index(:messages, [:conversation_id, :inserted_at]))

    create table(:user_blocks, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:actor_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:target_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:reason, :string)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(unique_index(:user_blocks, [:actor_profile_id, :target_profile_id]))
    create(index(:user_blocks, [:target_profile_id]))

    create table(:reports, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:reporter_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:target_profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:reason, :string, null: false)
      add(:details, :text)
      add(:status, :string, null: false, default: "open")
      add(:reviewed_by_user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:reviewed_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(index(:reports, [:status]))
    create(index(:reports, [:target_profile_id]))

    create table(:analytics_events, primary_key: false) do
      add(:id, :bigserial, primary_key: true)
      add(:user_id, references(:users, type: :binary_id, on_delete: :nilify_all))
      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :nilify_all))
      add(:event_name, :string, null: false)
      add(:payload, :map, null: false, default: %{}, null: false)

      timestamps(type: :utc_datetime, updated_at: false)
    end

    create(index(:analytics_events, [:event_name]))
    create(index(:analytics_events, [:profile_id]))
    create(index(:analytics_events, [:inserted_at]))
  end
end
