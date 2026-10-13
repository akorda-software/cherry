import type { ChatMessage, DiscoveryMatch, MatchSummary } from "@cherry/contracts";

/**
 * Reglas puras de la pestaña Chats: separar «Nuevos matches» (sin mensajes) de las
 * conversaciones, ordenar, vista previa del último mensaje y aviso amable de caducidad.
 */

export interface MatchSections {
  /** Matches sin mensajes todavía, el más reciente primero. */
  newMatches: MatchSummary[];
  /** Conversaciones con mensajes, por último mensaje (más reciente primero). */
  conversations: MatchSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Solo avisamos de la caducidad cuando faltan como mucho estos días. */
export const EXPIRY_HINT_THRESHOLD_DAYS = 7;

function timeOf(iso: string | null | undefined): number {
  if (!iso) {
    return 0;
  }

  const time = Date.parse(iso);
  return Number.isNaN(time) ? 0 : time;
}

/** Última actividad del match: su último mensaje o, si no hay, el momento del match. */
export function lastActivityAt(match: MatchSummary): number {
  return Math.max(timeOf(match.lastMessage?.insertedAt), timeOf(match.matchedAt));
}

export function splitMatches(matches: readonly MatchSummary[]): MatchSections {
  const newMatches = matches
    .filter((match) => match.lastMessage === null)
    .sort((a, b) => timeOf(b.matchedAt) - timeOf(a.matchedAt));

  const conversations = matches
    .filter((match) => match.lastMessage !== null)
    .sort((a, b) => lastActivityAt(b) - lastActivityAt(a));

  return { newMatches, conversations };
}

/** El último mensaje lo escribí yo (en un 1:1, todo lo que no manda la otra persona). */
export function isOwnLastMessage(match: MatchSummary): boolean {
  return match.lastMessage !== null && match.lastMessage.senderProfileId !== match.otherProfile.id;
}

/** Vista previa de una línea: «Tú: ¿cenamos el viernes?». */
export function lastMessagePreview(match: MatchSummary): string {
  if (match.lastMessage === null) {
    return "";
  }

  const body = match.lastMessage.body.replace(/\s+/g, " ").trim();
  return isOwnLastMessage(match) ? `Tú: ${body}` : body;
}

export function displayNameOf(match: Pick<MatchSummary, "otherProfile">): string {
  const name = match.otherProfile.displayName?.trim();
  return name ? name : "Alguien";
}

export interface ExpiryHint {
  daysLeft: number;
  /** Texto corto bajo el avatar: «quedan 5 días», «queda 1 día». */
  short: string;
  /** Texto para lectores de pantalla. */
  accessibilityLabel: string;
}

/**
 * Aviso de caducidad sin agobiar: solo si el match aún no tiene mensajes y faltan
 * `EXPIRY_HINT_THRESHOLD_DAYS` días o menos.
 */
export function matchExpiryHint(
  expiresAt: string | null,
  now: number = Date.now(),
  thresholdDays: number = EXPIRY_HINT_THRESHOLD_DAYS
): ExpiryHint | null {
  if (expiresAt === null) {
    return null;
  }

  const remaining = timeOf(expiresAt) - now;

  if (remaining <= 0) {
    return null;
  }

  const daysLeft = Math.ceil(remaining / DAY_MS);

  if (daysLeft > thresholdDays) {
    return null;
  }

  if (daysLeft === 1) {
    return {
      daysLeft,
      short: "queda 1 día",
      accessibilityLabel: "Queda 1 día para saludar"
    };
  }

  return {
    daysLeft,
    short: `quedan ${daysLeft} días`,
    accessibilityLabel: `Quedan ${daysLeft} días para saludar`
  };
}

/** `MatchSummary` a partir del match recién creado (likes, descubrir) para verlo al instante en Chats. */
export function matchSummaryFromDiscoveryMatch(match: DiscoveryMatch): MatchSummary {
  return {
    id: match.id,
    conversationId: match.conversationId,
    matchedAt: match.matchedAt,
    expiresAt: match.expiresAt,
    firstMessageAt: null,
    otherProfile: { ...match.otherProfile },
    lastMessage: null,
    unreadCount: 0
  };
}

/**
 * Aplica un mensaje nuevo a su match: pasa a ser el último, deja de caducar y, si es mío o la
 * conversación está abierta, no cuenta como no leído.
 */
export function applyMessageToMatch(
  match: MatchSummary,
  message: ChatMessage,
  { read }: { read: boolean }
): MatchSummary {
  const isNewer = match.lastMessage === null || timeOf(message.insertedAt) >= timeOf(match.lastMessage.insertedAt);
  const mine = message.senderProfileId !== match.otherProfile.id;

  if (!isNewer || match.lastMessage?.id === message.id) {
    return read && match.unreadCount > 0 ? { ...match, unreadCount: 0 } : match;
  }

  return {
    ...match,
    lastMessage: message,
    expiresAt: null,
    firstMessageAt: match.firstMessageAt ?? message.insertedAt,
    unreadCount: read || mine ? 0 : match.unreadCount + 1
  };
}
