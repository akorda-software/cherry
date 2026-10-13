defmodule Cherry.Dating.ConversationReads do
  @moduledoc "Participant read watermarks. Concurrent updates can only move forward."

  import Ecto.Query
  alias Cherry.Dating.{Conversation, ConversationRead, Match}
  alias Cherry.Repo

  @doc """
  Marca la conversación como leída por `profile_id` hasta `now` (nunca retrocede).
  Solo participantes; funciona aunque el match ya no esté activo.
  """
  def mark_read(conversation_id, profile_id, now \\ DateTime.utc_now()) do
    with {:ok, conversation_id} <- Ecto.UUID.cast(conversation_id),
         %Match{} = match <- match_for_conversation(conversation_id),
         true <- participant?(match, profile_id) do
      upsert_read(conversation_id, profile_id, now)
    else
      _not_participant -> {:error, :not_participant}
    end
  end

  # ── Reads ──────────────────────────────────────────────────────────────

  defp match_for_conversation(conversation_id) do
    Repo.one(
      from(m in Match,
        join: c in Conversation,
        on: c.match_id == m.id,
        where: c.id == ^conversation_id
      )
    )
  end

  defp participant?(%Match{profile_a_id: a, profile_b_id: b}, profile_id),
    do: profile_id in [a, b]

  defp upsert_read(conversation_id, profile_id, now) do
    now = to_usec(now)

    %ConversationRead{}
    |> ConversationRead.changeset(%{
      conversation_id: conversation_id,
      profile_id: profile_id,
      last_read_at: now
    })
    |> Repo.insert(
      on_conflict:
        from(r in ConversationRead,
          update: [
            set: [
              last_read_at: fragment("GREATEST(?, EXCLUDED.last_read_at)", r.last_read_at),
              updated_at: fragment("EXCLUDED.updated_at")
            ]
          ]
        ),
      conflict_target: [:conversation_id, :profile_id],
      returning: true
    )
  end

  # Los campos :utc_datetime_usec exigen precisión 6 al volcarse a la BD.
  defp to_usec(%DateTime{microsecond: {value, _precision}} = at),
    do: %{at | microsecond: {value, 6}}
end
