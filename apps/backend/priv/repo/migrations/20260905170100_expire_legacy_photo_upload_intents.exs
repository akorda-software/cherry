defmodule Snack.Repo.Migrations.ExpireLegacyPhotoUploadIntents do
  use Ecto.Migration

  def up do
    # Older signed URLs allow overwriting an object after verification.
    # Require a fresh conditional PUT intent for uploads still in progress.
    execute(
      "UPDATE profile_photo_upload_intents SET expires_at = LEAST(expires_at, timezone('UTC', now()) - interval '1 second') WHERE completed_at IS NULL"
    )
  end

  def down, do: :ok
end
