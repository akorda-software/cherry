defmodule Snack.Repo.Migrations.CreateProfilePhotoUploadIntents do
  use Ecto.Migration

  def change do
    create table(:profile_photo_upload_intents, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:storage_key, :string, null: false)
      add(:public_url, :text, null: false)
      add(:position, :integer, null: false)
      add(:content_type, :string, null: false)
      add(:size_bytes, :integer, null: false)
      add(:expires_at, :utc_datetime, null: false)
      add(:completed_at, :utc_datetime)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:profile_photo_upload_intents, [:storage_key]))
    create(index(:profile_photo_upload_intents, [:profile_id]))
    create(index(:profile_photo_upload_intents, [:expires_at]))
  end
end
