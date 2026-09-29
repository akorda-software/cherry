import type { CursorPageQuery } from "./common";

/** Resumen del otro perfil en matches/conversaciones. `photoUrl` = foto principal (absoluta). */
export interface MatchProfileSummary {
  id: string;
  displayName: string | null;
  age: number | null;
  photoUrl: string | null;
}

/** Mensaje de chat (REST y WebSocket usan la misma forma). */
export interface ChatMessage {
  id: string;
  conversationId: string;
  senderProfileId: string;
  body: string;
  insertedAt: string;
}

/**
 * Match activo (`GET /api/matches`). Excluye caducados, deshechos, bloqueados y cuentas borradas.
 * `expiresAt` = caducidad a 30 días si nadie escribe; `null` tras el primer mensaje.
 * Orden: actividad más reciente primero (último mensaje o `matchedAt`).
 */
export interface MatchSummary {
  id: string;
  conversationId: string;
  matchedAt: string;
  expiresAt: string | null;
  firstMessageAt: string | null;
  otherProfile: MatchProfileSummary;
  lastMessage: ChatMessage | null;
  /** Mensajes del otro perfil posteriores a la última lectura del viewer. */
  unreadCount: number;
}

export interface MatchesResponse {
  matches: MatchSummary[];
}

/** Conversación activa (`GET /api/conversations`), coherente con `MatchSummary`. */
export interface ConversationSummary {
  id: string;
  matchId: string;
  matchedAt: string;
  expiresAt: string | null;
  otherProfile: MatchProfileSummary;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  insertedAt: string;
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

export type ConversationMessagesQuery = CursorPageQuery;

/** `GET /api/conversations/:id/messages`: más nuevos primero; `nextCursor` opaco para ir hacia atrás. */
export interface ConversationMessagesPage {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface SendMessageRequest {
  body: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
}

export const MAX_MESSAGE_LENGTH = 2000;

/** Días que dura un match sin mensajes antes de caducar (decisión D-2026-09-29). */
export const MATCH_EXPIRY_DAYS = 30;

/**
 * Errores de matches/chat (REST y join del canal):
 * - 403 `not_participant` | `conversation_not_active` (bloqueo, deshecho, caducado o cuenta borrada:
 *   también cierra el historial REST)
 * - 404 `profile_not_found` | `match_not_found`
 * - 422 `invalid_cursor` | `invalid_limit` | `errors.body` (mensaje vacío o > 2000)
 * - join del canal: `profile_required` | `not_participant` | `conversation_not_active`
 */
export type ChatErrorCode =
  | "profile_not_found"
  | "profile_required"
  | "match_not_found"
  | "not_participant"
  | "conversation_not_active";

/** Payload del evento `typing` del canal `chat:{conversationId}`. */
export interface ChatTypingEvent {
  conversationId: string;
  profileId: string;
}

/** Eventos servidor → cliente del canal `chat:{conversationId}`. */
export interface ChatChannelServerEvents {
  new_message: ChatMessage;
  typing: ChatTypingEvent;
}
