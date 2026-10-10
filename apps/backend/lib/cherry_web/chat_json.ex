defmodule CherryWeb.ChatJSON do
  @moduledoc """
  Serializadores de matches, conversaciones y mensajes compartidos por REST y
  el canal de chat (`MatchSummary`, `ConversationSummary`, `ChatMessage`).
  """

  alias Cherry.Dating.Match
  alias Cherry.Dating.Message
  alias Cherry.Dating.Profile
  alias CherryWeb.MediaUrl

  @doc "Mensaje de chat (`ChatMessage`); el body llega ya descifrado del schema."
  def message(%Message{} = msg) do
    %{
      id: msg.id,
      conversationId: msg.conversation_id,
      senderProfileId: msg.sender_profile_id,
      body: msg.body,
      # Milisegundos en JSON: seguro para cualquier motor JS (Hermes incluido).
      insertedAt: DateTime.truncate(msg.inserted_at, :millisecond)
    }
  end

  def message(nil), do: nil

  @doc "Resumen del otro perfil (`MatchProfileSummary`)."
  def profile_summary(conn, %Profile{} = profile, photo_url) do
    %{
      id: profile.id,
      displayName: profile.display_name,
      age: Profile.age(profile),
      photoUrl: MediaUrl.absolute(conn, photo_url)
    }
  end

  @doc "`MatchSummary` a partir de una entrada de `Cherry.Dating.Inbox.list/2`."
  def match_summary(conn, %{match: %Match{} = match} = entry) do
    %{
      id: match.id,
      conversationId: entry.conversation_id,
      matchedAt: match.matched_at,
      expiresAt: match.expires_at,
      firstMessageAt: match.first_message_at,
      otherProfile: profile_summary(conn, entry.other, entry.other_photo_url),
      lastMessage: message(entry.last_message),
      unreadCount: entry.unread_count
    }
  end

  @doc "`ConversationSummary` a partir de una entrada de `Cherry.Dating.Inbox.list/2`."
  def conversation_summary(conn, %{match: %Match{} = match} = entry) do
    %{
      id: entry.conversation_id,
      matchId: match.id,
      matchedAt: match.matched_at,
      expiresAt: match.expires_at,
      otherProfile: profile_summary(conn, entry.other, entry.other_photo_url),
      lastMessage: message(entry.last_message),
      unreadCount: entry.unread_count,
      insertedAt: entry.conversation_inserted_at
    }
  end
end
