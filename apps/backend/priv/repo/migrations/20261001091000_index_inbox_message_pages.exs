defmodule Snack.Repo.Migrations.IndexInboxMessagePages do
  use Ecto.Migration

  @disable_ddl_transaction true

  def change do
    create index(:messages, [:conversation_id, "inserted_at DESC", "id DESC"],
             name: :messages_conversation_keyset_index,
             concurrently: true
           )

    create index(:messages, [:conversation_id, :sender_profile_id, :inserted_at],
             name: :messages_conversation_unread_index,
             concurrently: true
           )
  end
end
