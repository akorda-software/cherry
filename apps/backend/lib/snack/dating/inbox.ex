defmodule Snack.Dating.Inbox do
  @moduledoc """
  Bandeja social: matches/conversaciones visibles con foto, último mensaje y no
  leídos, estado de lectura (`conversation_reads`) y paginación de mensajes.

  Todas las listas y contadores comparten la misma regla de visibilidad: match
  activo y sin caducar (`expires_at` vencido = caducado, aunque el barrido aún no
  haya cambiado su `status`), sin bloqueo en ninguna dirección y ninguna de las
  dos cuentas borrada. Todo se resuelve en una consulta por lista (sin N+1).
  """

  import Ecto.Query

  alias Snack.Accounts.User
  alias Snack.Dating.Conversation
  alias Snack.Dating.ConversationRead
  alias Snack.Dating.Match
  alias Snack.Dating.Message
  alias Snack.Dating.Profile
  alias Snack.Dating.UserBlock
  alias Snack.Repo

  @cursor_prefix "m1:"

  @type entry :: %{
          match: %Match{},
          conversation_id: Ecto.UUID.t(),
          conversation_inserted_at: DateTime.t(),
          other: %Profile{},
          other_photo_url: String.t() | nil,
          last_message: %Message{} | nil,
          unread_count: non_neg_integer()
        }

  @doc """
  Matches (con su conversación) visibles para `profile_id`, ordenados por
  actividad: último mensaje o, si no hay, `matched_at`.
  """
  @spec list(Ecto.UUID.t(), DateTime.t()) :: [entry()]
  def list(profile_id, now \\ now()) do
    last_message =
      from(msg in Message,
        where: msg.conversation_id == parent_as(:conversation).id,
        order_by: [desc: msg.inserted_at, desc: msg.id],
        limit: 1
      )

    from([match: m, conversation: c, other: other] in visible_query(profile_id, now),
      left_lateral_join: lm in subquery(last_message),
      on: true,
      left_join: r in ConversationRead,
      on: r.conversation_id == c.id and r.profile_id == ^profile_id,
      order_by: [desc: coalesce(lm.inserted_at, m.matched_at), desc: m.id],
      select: %{
        match: m,
        conversation_id: c.id,
        conversation_inserted_at: c.inserted_at,
        other: other,
        last_message: lm,
        other_photo_url:
          fragment(
            "(SELECT ph.url FROM profile_photos ph WHERE ph.profile_id = ? AND ph.is_active = true ORDER BY ph.position ASC LIMIT 1)",
            other.id
          ),
        unread_count:
          fragment(
            "(SELECT count(*)::int FROM messages mm WHERE mm.conversation_id = ? AND mm.sender_profile_id = ? AND mm.inserted_at > COALESCE(?, '-infinity'::timestamp))",
            c.id,
            other.id,
            r.last_read_at
          )
      }
    )
    |> Repo.all()
    |> Enum.map(&normalize_last_message/1)
  end

  @doc """
  Contadores para badges: matches sin mensajes que el viewer aún no ha abierto y
  conversaciones con mensajes del otro sin leer.
  """
  @spec counts(Ecto.UUID.t(), DateTime.t()) :: %{
          new_matches_count: non_neg_integer(),
          unread_conversations_count: non_neg_integer()
        }
  def counts(profile_id, now \\ now()) do
    from([match: m, conversation: c, other: other] in visible_query(profile_id, now),
      left_join: r in ConversationRead,
      on: r.conversation_id == c.id and r.profile_id == ^profile_id,
      select: %{
        new_matches_count:
          fragment("count(*) FILTER (WHERE ? IS NULL AND ? IS NULL)", m.first_message_at, r.id),
        unread_conversations_count:
          fragment(
            "count(*) FILTER (WHERE EXISTS (SELECT 1 FROM messages mm WHERE mm.conversation_id = ? AND mm.sender_profile_id = ? AND mm.inserted_at > COALESCE(?, '-infinity'::timestamp)))",
            c.id,
            other.id,
            r.last_read_at
          )
      }
    )
    |> Repo.one()
  end

  @doc """
  Marca la conversación como leída por `profile_id` hasta `now` (nunca retrocede).
  Solo participantes; funciona aunque el match ya no esté activo.
  """
  def mark_read(conversation_id, profile_id, now \\ now()) do
    with {:ok, conversation_id} <- Ecto.UUID.cast(conversation_id),
         %Match{} = match <- match_for_conversation(conversation_id),
         true <- participant?(match, profile_id) do
      upsert_read(conversation_id, profile_id, now)
    else
      _not_participant -> {:error, :not_participant}
    end
  end

  @doc """
  Página de mensajes, más nuevos primero. `cursor` es el `next_cursor` opaco de
  una página anterior (o, por compatibilidad, un instante ISO 8601).
  """
  def list_messages_page(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    with {:ok, cursor} <- decode_cursor(Keyword.get(opts, :cursor)) do
      rows =
        from(m in Message,
          where: m.conversation_id == ^conversation_id,
          order_by: [desc: m.inserted_at, desc: m.id],
          limit: ^(limit + 1)
        )
        |> apply_cursor(cursor)
        |> Repo.all()

      page = Enum.take(rows, limit)
      next_cursor = if length(rows) > limit, do: encode_cursor(List.last(page))

      {:ok, %{messages: page, next_cursor: next_cursor}}
    end
  end

  # ── Visibility ─────────────────────────────────────────────────────────

  defp visible_query(profile_id, now) do
    blocked_pair =
      from(b in UserBlock,
        where:
          (b.actor_profile_id == parent_as(:match).profile_a_id and
             b.target_profile_id == parent_as(:match).profile_b_id) or
            (b.actor_profile_id == parent_as(:match).profile_b_id and
               b.target_profile_id == parent_as(:match).profile_a_id),
        select: 1
      )

    from(m in Match,
      as: :match,
      join: c in Conversation,
      as: :conversation,
      on: c.match_id == m.id,
      join: other in Profile,
      as: :other,
      on:
        (m.profile_a_id == ^profile_id and other.id == m.profile_b_id) or
          (m.profile_b_id == ^profile_id and other.id == m.profile_a_id),
      join: other_user in User,
      on: other_user.id == other.user_id,
      where: m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id,
      where: m.status == "active",
      where: is_nil(m.expires_at) or m.expires_at > ^now,
      where: is_nil(other.deleted_at) and is_nil(other_user.deleted_at),
      where: not exists(subquery(blocked_pair))
    )
  end

  # A left lateral join without a row yields a struct with every field nil.
  defp normalize_last_message(%{last_message: %Message{id: nil}} = entry),
    do: %{entry | last_message: nil}

  defp normalize_last_message(entry), do: entry

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
    now = DateTime.truncate(now, :second)

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

  # ── Message cursor ─────────────────────────────────────────────────────

  defp apply_cursor(query, nil), do: query

  defp apply_cursor(query, {:before, %DateTime{} = at, id}) do
    from(m in query,
      where: m.inserted_at < ^at or (m.inserted_at == ^at and m.id < ^id)
    )
  end

  defp apply_cursor(query, {:before_time, %DateTime{} = at}) do
    from(m in query, where: m.inserted_at < ^at)
  end

  defp encode_cursor(%Message{inserted_at: at, id: id}) do
    Base.url_encode64(@cursor_prefix <> Integer.to_string(DateTime.to_unix(at)) <> ":" <> id,
      padding: false
    )
  end

  defp decode_cursor(nil), do: {:ok, nil}
  defp decode_cursor(""), do: {:ok, nil}

  defp decode_cursor(cursor) when is_binary(cursor) and byte_size(cursor) <= 256 do
    with {:ok, @cursor_prefix <> payload} <- Base.url_decode64(cursor, padding: false),
         [unix, id] <- String.split(payload, ":", parts: 2),
         {unix, ""} <- Integer.parse(unix),
         {:ok, at} <- DateTime.from_unix(unix),
         {:ok, id} <- Ecto.UUID.cast(id) do
      {:ok, {:before, at, id}}
    else
      _opaque_cursor_invalid -> decode_legacy_cursor(cursor)
    end
  end

  defp decode_cursor(_cursor), do: {:error, :invalid_cursor}

  defp decode_legacy_cursor(cursor) do
    case DateTime.from_iso8601(cursor) do
      {:ok, at, _offset} -> {:ok, {:before_time, DateTime.truncate(at, :second)}}
      _error -> {:error, :invalid_cursor}
    end
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
