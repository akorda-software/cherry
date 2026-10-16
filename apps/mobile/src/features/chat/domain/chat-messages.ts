import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@cherry/contracts";

/**
 * Lógica pura de la conversación: fusión y deduplicación de mensajes del servidor,
 * cola optimista de envíos y validación del texto. Sin React ni red.
 *
 * Convención: las listas de mensajes del servidor van SIEMPRE de más nuevo a más antiguo
 * (como el historial REST y como las pinta la lista invertida).
 */

export type OutgoingStatus = "sending" | "failed";

/** Mensaje propio aún sin confirmar por el servidor (envío optimista). */
export interface OutgoingMessage {
  clientId: string;
  conversationId: string;
  body: string;
  /** Hora local de creación (ISO). */
  createdAt: string;
  status: OutgoingStatus;
  attempts: number;
  /**
   * El último intento acabó sin saber si llegó (timeout o red caída a mitad).
   * Antes de reenviar hay que mirar el historial para no duplicarlo.
   */
  ambiguous: boolean;
  /** `false` si reintentar no sirve (conversación cerrada, texto inválido). */
  retryable: boolean;
}

export const MIN_MESSAGE_LENGTH = 1;
export { MAX_MESSAGE_LENGTH };

/** Normaliza el texto a enviar: recorta espacios y saltos al principio y al final. */
export function normalizeMessageBody(body: string): string {
  return body.trim();
}

export type MessageBodyValidation = { ok: true; body: string } | { ok: false; reason: "empty" | "too_long" };

export function validateMessageBody(body: string): MessageBodyValidation {
  const normalized = normalizeMessageBody(body);

  if (normalized.length < MIN_MESSAGE_LENGTH) {
    return { ok: false, reason: "empty" };
  }

  if (countCharacters(normalized) > MAX_MESSAGE_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  return { ok: true, body: normalized };
}

/**
 * Caracteres tal y como los cuenta el backend (Ecto `length` cuenta grafemas; aquí contamos
 * code points, que coincide salvo en emojis compuestos: nunca nos quedamos cortos).
 */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

export function messageTime(message: Pick<ChatMessage, "insertedAt">): number {
  const time = Date.parse(message.insertedAt);
  return Number.isNaN(time) ? 0 : time;
}

/** Orden estable de más nuevo a más antiguo (los empates conservan el orden de entrada). */
export function sortNewestFirst(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages
    .map((message, index) => ({ message, index, time: messageTime(message) }))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map(({ message }) => message);
}

export interface MergeResult {
  messages: ChatMessage[];
  /** Mensajes que no estaban (en el orden recibido). */
  added: ChatMessage[];
}

/**
 * Fusiona mensajes del servidor por `id`.
 * - `newer`: tiempo real y backfill; ante empate de segundo, lo recibido se considera más nuevo.
 * - `older`: páginas antiguas; ante empate, lo recibido se considera más antiguo.
 */
export function mergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
  tie: "newer" | "older" = "newer"
): MergeResult {
  if (incoming.length === 0) {
    return { messages: existing as ChatMessage[], added: [] };
  }

  const known = new Set(existing.map((message) => message.id));
  const added: ChatMessage[] = [];

  for (const message of incoming) {
    if (!known.has(message.id)) {
      known.add(message.id);
      added.push(message);
    }
  }

  if (added.length === 0) {
    return { messages: existing as ChatMessage[], added };
  }

  const first = tie === "newer" ? added : existing;
  const second = tie === "newer" ? existing : added;
  return { messages: mergeByTime(first, second), added };
}

/** Claves temporales por llamada, sin caché ni metadatos en los mensajes del servidor. */
function mergeByTime(first: readonly ChatMessage[], second: readonly ChatMessage[]): ChatMessage[] {
  const combined = [...first, ...second];
  const times = new Array<number>(combined.length);
  let combinedOrdered = true;

  for (let index = 0; index < combined.length; index += 1) {
    const time = messageTime(combined[index]!);
    times[index] = time;
    if (index > 0 && time > times[index - 1]!) {
      combinedOrdered = false;
      if (index !== first.length) {
        // Primer desorden interno: sort estable, reutilizando las claves ya leídas.
        return combined
          .map((message, index) => ({ message, index, time: times[index] ?? messageTime(message) }))
          .sort((a, b) => b.time - a.time || a.index - b.index)
          .map(({ message }) => message);
      }
    }
  }

  // Lo habitual en tiempo real/paginación: basta con concatenar, sin ordenar ni decorar.
  if (combinedOrdered) return combined;

  const merged = new Array<ChatMessage>(combined.length);
  let target = 0;
  let left = 0;
  let right = first.length;
  while (left < first.length && right < combined.length) {
    // Ante empate gana `first`: equivale al orden de entrada del sort estable.
    if (times[left]! >= times[right]!) merged[target++] = combined[left++]!;
    else merged[target++] = combined[right++]!;
  }
  while (left < first.length) merged[target++] = combined[left++]!;
  while (right < combined.length) merged[target++] = combined[right++]!;
  return merged;
}

/** Margen para relojes desfasados al emparejar un mensaje propio con su envío optimista. */
const RECONCILE_SKEW_MS = 2 * 60_000;

export interface ReconcileResult {
  outbox: OutgoingMessage[];
  /** clientId → id del servidor de los envíos que ya constan como entregados. */
  delivered: Map<string, string>;
}

/**
 * Empareja mensajes propios llegados del servidor (eco del canal, backfill) con envíos
 * optimistas pendientes o fallidos con el mismo texto: si ya están en el servidor, salen de la
 * cola. Así un reintento tras un timeout nunca duplica el mensaje.
 */
export function reconcileOutbox(
  outbox: readonly OutgoingMessage[],
  ownMessages: readonly ChatMessage[]
): ReconcileResult {
  const delivered = new Map<string, string>();

  if (outbox.length === 0 || ownMessages.length === 0) {
    return { outbox: outbox as OutgoingMessage[], delivered };
  }

  // Del más antiguo al más nuevo para emparejar en orden de envío.
  const chronological = [...ownMessages].sort((a, b) => messageTime(a) - messageTime(b));
  let remaining = [...outbox];

  for (const message of chronological) {
    const match = remaining.find(
      (item) =>
        item.conversationId === message.conversationId &&
        item.body === message.body &&
        messageTime(message) >= Date.parse(item.createdAt) - RECONCILE_SKEW_MS
    );

    if (match) {
      delivered.set(match.clientId, message.id);
      remaining = remaining.filter((item) => item.clientId !== match.clientId);
    }
  }

  return { outbox: delivered.size === 0 ? (outbox as OutgoingMessage[]) : remaining, delivered };
}

/** ¿Hay solape entre una página nueva y lo que ya teníamos? (si no, hay hueco en el medio). */
export function pagesOverlap(existing: readonly ChatMessage[], page: readonly ChatMessage[]): boolean {
  if (existing.length === 0 || page.length === 0) {
    return true;
  }

  const known = new Set(existing.map((message) => message.id));
  if (page.some((message) => known.has(message.id))) {
    return true;
  }

  // Sin ids comunes: solapan si la página llega hasta el mensaje más nuevo que teníamos.
  const newestKnown = messageTime(existing[0]!);
  const oldestInPage = messageTime(page[page.length - 1]!);
  return oldestInPage <= newestKnown;
}
