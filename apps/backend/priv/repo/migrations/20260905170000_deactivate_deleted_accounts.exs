defmodule Snack.Repo.Migrations.DeactivateDeletedAccounts do
  use Ecto.Migration

  def up do
    alter table(:users) do
      add(:deleted_at, :utc_datetime)
    end

    execute(
      "UPDATE users u SET deleted_at = p.deleted_at FROM profiles p WHERE p.user_id = u.id AND p.deleted_at IS NOT NULL"
    )

    execute(
      "UPDATE session_families s SET revoked_at = u.deleted_at FROM users u WHERE s.user_id = u.id AND u.deleted_at IS NOT NULL"
    )

    execute(
      "UPDATE refresh_tokens r SET status = 'revoked', revoked_at = s.revoked_at FROM session_families s WHERE r.session_family_id = s.id AND s.revoked_at IS NOT NULL"
    )

    execute(
      "UPDATE push_tokens p SET status = 'inactive', disabled_at = u.deleted_at FROM users u WHERE p.user_id = u.id AND u.deleted_at IS NOT NULL"
    )
  end

  def down do
    alter table(:users) do
      remove(:deleted_at)
    end
  end
end
