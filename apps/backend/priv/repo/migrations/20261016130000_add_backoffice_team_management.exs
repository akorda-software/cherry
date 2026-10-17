defmodule Cherry.Repo.Migrations.AddBackofficeTeamManagement do
  use Ecto.Migration

  def up do
    drop(constraint(:backoffice_staff, :staff_role))

    create(
      constraint(:backoffice_staff, :staff_role,
        check: "role IN ('superadmin', 'admin', 'moderator', 'privacy')"
      )
    )

    alter table(:backoffice_staff) do
      add(:password_hash, :text)
      add(:failed_login_attempts, :integer, null: false, default: 0)
      add(:login_blocked_until, :utc_datetime)
    end

    create table(:backoffice_login_attempts, primary_key: false) do
      add(:key, :binary, primary_key: true)
      add(:attempts, :integer, null: false)
      add(:expires_at, :utc_datetime, null: false)
    end
  end

  def down do
    drop(table(:backoffice_login_attempts))

    alter table(:backoffice_staff) do
      remove(:password_hash)
      remove(:failed_login_attempts)
      remove(:login_blocked_until)
    end

    execute("UPDATE backoffice_staff SET role = 'admin' WHERE role = 'superadmin'")
    drop(constraint(:backoffice_staff, :staff_role))

    create(
      constraint(:backoffice_staff, :staff_role,
        check: "role IN ('admin', 'moderator', 'privacy')"
      )
    )
  end
end
