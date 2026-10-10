defmodule Cherry.Repo.Migrations.RemoveRedundantMessageIndex do
  use Ecto.Migration

  @disable_ddl_transaction true

  # The keyset index covers this conversation/time prefix in either direction.
  # Keeping both would add an unnecessary index write for every chat message.
  def up do
    drop_if_exists index(:messages, [:conversation_id, :inserted_at], concurrently: true)
  end

  def down do
    create_if_not_exists index(:messages, [:conversation_id, :inserted_at], concurrently: true)
  end
end
