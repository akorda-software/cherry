defmodule Cherry.Repo.Migrations.PhotoStorageCleanup do
  @moduledoc """
  Borrado físico de objetos de fotos (`Cherry.Dating.PhotoStorage`):
  `storage_deleted_at` marca fotos e intents cuyos objetos ya se borraron.
  Las fotos ya inactivas o de cuentas ya borradas quedan sin marcar, así que el
  primer barrido borra también sus objetos. Índices para el barrido y para el
  límite de intents por perfil y hora.
  """
  use Ecto.Migration

  def change do
    alter table(:profile_photos) do
      add(:storage_deleted_at, :utc_datetime)
    end

    alter table(:profile_photo_upload_intents) do
      add(:storage_deleted_at, :utc_datetime)
    end

    create(
      index(:profile_photo_upload_intents, [:expires_at],
        where: "storage_deleted_at IS NULL",
        name: :profile_photo_upload_intents_unswept_index
      )
    )

    create(index(:profile_photo_upload_intents, [:profile_id, :inserted_at]))

    create(
      index(:profile_photos, [:profile_id],
        where: "storage_deleted_at IS NULL AND NOT is_active",
        name: :profile_photos_unpurged_inactive_index
      )
    )
  end
end
