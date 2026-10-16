defmodule Cherry.Dating.Inbox do
  @moduledoc """
  Bandeja social: matches/conversaciones visibles con foto, último mensaje y no
  leídos, estado de lectura (`conversation_reads`) y paginación de mensajes.

  Todas las listas y contadores comparten la misma regla de visibilidad: match
  activo y sin caducar (`expires_at` vencido = caducado, aunque el barrido aún no
  haya cambiado su `status`), sin bloqueo en ninguna dirección y ninguna de las
  dos cuentas borrada. Todo se resuelve en una consulta por lista (sin N+1).
  """

  import Ecto.Query

  alias Cherry.Accounts.User
  alias Cherry.Dating.Conversation
  alias Cherry.Dating.ConversationRead
  alias Cherry.Dating.InboxCursor
  alias Cherry.Dating.Match
  alias Cherry.Dating.Message
  alias Cherry.Dating.Profile
  alias Cherry.Dating.UserBlock
  alias Cherry.Repo

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
    visible_query(profile_id, now)
    |> enrich(profile_id)
    |> order_by([match: m, last_message: lm],
      desc: coalesce(lm.inserted_at, m.matched_at),
      desc: m.id
    )
    |> Repo.all()
    |> Enum.map(&normalize_last_message/1)
  end

  @doc """
  Bounded API page by activity and match ID. The signed cursor pins the reference
  instant: new messages and matches don't move entries between these pages.
  Visibility and unread counts are checked afresh. Bodies, photos and unread
  counts are fetched only for the selected page, never the entire inbox.
  """
  def list_page(profile_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)

    with true <- is_integer(limit) and limit in 1..100,
         {:ok, cursor} <- InboxCursor.decode(Keyword.get(opts, :cursor), profile_id) do
      at = if cursor, do: cursor.at, else: Keyword.get(opts, :now, DateTime.utc_now())
      visible = visible_query(profile_id, now())

      last_activity =
        from(msg in Message,
          where: msg.conversation_id == parent_as(:conversation).id and msg.inserted_at <= ^at,
          order_by: [desc: msg.inserted_at, desc: msg.id],
          limit: 1,
          select: %{inserted_at: msg.inserted_at}
        )

      page =
        from([match: m] in visible,
          left_lateral_join: lm in subquery(last_activity),
          as: :last_activity,
          on: true,
          where: m.matched_at <= ^at,
          order_by: [desc: coalesce(lm.inserted_at, m.matched_at), desc: m.id],
          select: %{
            match_id: m.id,
            activity_at: type(coalesce(lm.inserted_at, m.matched_at), :utc_datetime_usec)
          },
          limit: ^(limit + 1)
        )
        |> before_activity(cursor)

      entries =
        from([match: m] in visible,
          join: selected in subquery(page),
          as: :selected_page,
          on: selected.match_id == m.id,
          order_by: [desc: selected.activity_at, desc: m.id]
        )
        |> enrich(profile_id, at)
        |> select_merge([selected_page: selected], %{activity_at: selected.activity_at})
        |> Repo.all()
        |> Enum.map(&normalize_last_message/1)

      rows = Enum.take(entries, limit)

      next_cursor =
        if length(entries) > limit, do: InboxCursor.encode(List.last(rows), profile_id, at)

      {:ok, %{entries: rows, next_cursor: next_cursor}}
    else
      false -> {:error, :invalid_limit}
      error -> error
    end
  end

  def get_entry(conversation_id, profile_id) do
    with {:ok, id} <- Ecto.UUID.cast(conversation_id) do
      from([conversation: c] in visible_query(profile_id, now()), where: c.id == ^id)
      |> enrich(profile_id)
      |> Repo.one()
      |> case do
        nil -> {:error, :conversation_not_active}
        entry -> {:ok, normalize_last_message(entry)}
      end
    else
      :error -> {:error, :not_participant}
    end
  end

  defp before_activity(query, nil), do: query

  defp before_activity(query, cursor) do
    from([match: m, last_activity: lm] in query,
      where:
        fragment(
          "(COALESCE(?, ?), ?) < (?, ?)",
          lm.inserted_at,
          m.matched_at,
          m.id,
          type(^cursor.activity, :utc_datetime_usec),
          type(^cursor.id, :binary_id)
        )
    )
  end

  defp enrich(query, profile_id, at \\ nil) do
    last_message =
      from(msg in Message,
        where: msg.conversation_id == parent_as(:conversation).id,
        order_by: [desc: msg.inserted_at, desc: msg.id],
        limit: 1
      )
      |> then(fn q -> if at, do: where(q, [msg], msg.inserted_at <= ^at), else: q end)

    from([match: m, conversation: c, other: other] in query,
      left_lateral_join: lm in subquery(last_message),
      as: :last_message,
      on: true,
      left_join: r in ConversationRead,
      on: r.conversation_id == c.id and r.profile_id == ^profile_id,
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
    profile_id |> counts_query(now) |> Repo.one()
  end

  @doc false
  def counts_query(profile_id, now \\ now()) do
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
  end

  defdelegate mark_read(conversation_id, profile_id, at \\ DateTime.utc_now()),
    to: Cherry.Dating.ConversationReads

  defdelegate list_messages_page(conversation_id, opts \\ []),
    to: Cherry.Dating.MessagePages

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

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
