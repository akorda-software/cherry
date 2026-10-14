defmodule Cherry.Repo.Migrations.AddDeletionReasonToUsers do
  @moduledoc """
  Why an account was deleted. `user_request` (the person deleted it from the
  app) lets the same Google/Apple account sign up again from scratch: the old
  account is purged on the next login. Any other reason (moderation, when it
  exists) keeps the login blocked.

  Every account deleted so far was deleted by its owner (`DELETE
  /api/me/account` is the only way), so they are backfilled as `user_request`.
  """
  use Ecto.Migration

  def up do
    alter table(:users) do
      add(:deletion_reason, :string)
    end

    execute("UPDATE users SET deletion_reason = 'user_request' WHERE deleted_at IS NOT NULL")
  end

  def down do
    alter table(:users) do
      remove(:deletion_reason)
    end
  end
end
