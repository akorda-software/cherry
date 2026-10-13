defmodule Cherry.Repo.Migrations.CreateConversationReads do
  @moduledoc """
  Estado de lectura por participante (D-2026-09-29): alimenta `unreadCount` en
  matches/conversaciones y los badges de `GET /api/me/summary`.

  También alarga a 30 días la caducidad de los matches pendientes (sin mensajes)
  creados con la regla anterior de 7 días (D-2026-09-29 — caducidad a 30 días),
  solo si aún no han caducado.
  """
  use Ecto.Migration

  def up do
    create table(:conversation_reads, primary_key: false) do
      add(:id, :binary_id, primary_key: true)

      add(:conversation_id, references(:conversations, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:profile_id, references(:profiles, type: :binary_id, on_delete: :delete_all),
        null: false
      )

      add(:last_read_at, :utc_datetime, null: false)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:conversation_reads, [:conversation_id, :profile_id]))
    create(index(:conversation_reads, [:profile_id]))

    execute("""
    UPDATE matches
    SET expires_at = matched_at + interval '30 days', updated_at = now()
    WHERE status = 'active'
      AND first_message_at IS NULL
      AND expires_at IS NOT NULL
      AND matched_at + interval '30 days' > expires_at
      -- Never resurrect a match that already expired (expiry is lazy: its
      -- status may still be 'active').
      AND expires_at > (now() AT TIME ZONE 'utc')
    """)
  end

  def down do
    drop(table(:conversation_reads))
  end
end
