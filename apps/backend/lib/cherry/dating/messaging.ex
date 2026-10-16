defmodule Cherry.Dating.Messaging do
  @moduledoc "Conversation access, message persistence and post-commit chat broadcasts."

  import Ecto.Query

  alias Cherry.Repo
  alias Cherry.Dating.Match
  alias Cherry.Dating.Conversation
  alias Cherry.Dating.Message

  # ── Chat ──────────────────────────────────────────────────────────────

  @doc """
  Lists conversations for a profile via active, non-expired matches. For the
  enriched API listing see `Cherry.Dating.Inbox`.
  """
  def list_conversations(profile_id) do
    now = now()

    Conversation
    |> join(:inner, [c], m in Match, on: c.match_id == m.id)
    |> where(
      [c, m],
      (m.profile_a_id == ^profile_id or m.profile_b_id == ^profile_id) and
        m.status == "active" and (is_nil(m.expires_at) or m.expires_at > ^now)
    )
    |> order_by([c], desc: c.inserted_at)
    |> preload([c, m], match: m)
    |> Repo.all()
  end

  @doc """
  Gets a single conversation by id.
  """
  def get_conversation(id) do
    case Ecto.UUID.cast(id) do
      {:ok, id} ->
        Repo.one(
          from(c in Conversation,
            join: m in Match,
            on: m.id == c.match_id,
            where: c.id == ^id,
            preload: [match: m]
          )
        )

      :error ->
        nil
    end
  end

  @doc """
  Lists messages for a conversation with pagination.

  `cursor` is an `inserted_at` DateTime; returns messages older than the cursor.
  """
  def list_messages(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    cursor = Keyword.get(opts, :cursor)

    Message
    |> where([m], m.conversation_id == ^conversation_id)
    |> then(fn q ->
      if cursor do
        cursor = %{cursor | microsecond: {elem(cursor.microsecond, 0), 6}}
        where(q, [m], m.inserted_at < ^cursor)
      else
        q
      end
    end)
    |> order_by([m], desc: m.inserted_at, desc: m.id)
    |> limit(^limit)
    |> Repo.all()
  end

  @doc """
  Sends a message in a conversation.

  On the first message in the conversation, updates the associated match:
  sets `first_message_at` and clears `expires_at`.

  Common send path for REST and WebSocket: after the commit it broadcasts
  `new_message` on `chat:<conversation_id>` (the channel's `handle_out` drops
  it for blocked pairs). The push job commits atomically with the message.
  """
  def send_message(attrs) do
    nested? = Repo.in_transaction?()
    conversation_id = attrs["conversation_id"] || attrs[:conversation_id]
    sender_profile_id = attrs["sender_profile_id"] || attrs[:sender_profile_id]

    Repo.transaction(fn ->
      # Serialize sends with blocking for this pair, then recheck authorization.
      case lock_match_for_conversation(conversation_id) do
        nil ->
          Repo.rollback(:not_participant)

        _match_id ->
          :ok
      end

      with {:ok, conversation} <-
             get_messageable_conversation(conversation_id, sender_profile_id),
           {:ok, message} <- %Message{} |> Message.changeset(attrs) |> Repo.insert() do
        if is_nil(conversation.match.first_message_at) do
          from(m in Match, where: m.id == ^conversation.match_id and is_nil(m.first_message_at))
          |> Repo.update_all(set: [first_message_at: now(), expires_at: nil])
        end

        case Cherry.Notifications.Outbox.enqueue_new_message(message, conversation.match) do
          {:ok, _jobs} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end

        # A nested transaction doesn't commit the caller's transaction. Persist
        # its broadcast rather than publishing a message that may roll back.
        if nested? do
          case Cherry.Dating.ChatBroadcastWorker.enqueue(message.id) do
            {:ok, _job} -> :ok
            {:error, reason} -> Repo.rollback(reason)
          end
        end

        message
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> case do
      {:ok, message} ->
        unless nested?, do: broadcast_new_message(message)
        {:ok, message}

      error ->
        error
    end
  end

  defp lock_match_for_conversation(conversation_id) do
    case Ecto.UUID.cast(conversation_id) do
      {:ok, conversation_id} ->
        Repo.one(
          from(m in Match,
            join: c in Conversation,
            on: c.match_id == m.id,
            where: c.id == ^conversation_id,
            lock: fragment("FOR UPDATE OF ?", m),
            select: m.id
          )
        )

      :error ->
        nil
    end
  end

  defdelegate get_messageable_conversation(conversation_id, profile_id),
    to: Cherry.Dating.ConversationAccess,
    as: :get

  defdelegate conversation_allows_messaging?(conversation_id, profile_id),
    to: Cherry.Dating.ConversationAccess,
    as: :allowed?

  def conversation_messaging_status(conversation_id, profile_id) do
    get_messageable_conversation(conversation_id, profile_id)
  end

  @doc false
  def broadcast_new_message(%Message{} = message) do
    CherryWeb.Endpoint.broadcast(
      "chat:" <> message.conversation_id,
      "new_message",
      CherryWeb.ChatJSON.message(message)
    )
  end

  defp now, do: DateTime.utc_now() |> DateTime.truncate(:second)
end
