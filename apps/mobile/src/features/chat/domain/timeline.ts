import type { ChatMessage } from "@cherry/contracts";

import type { OutgoingMessage } from "./chat-messages";
import { formatDaySeparator, localDayKey } from "./time-format";

/**
 * Construye los elementos de la lista invertida del chat (índice 0 = abajo del todo = más nuevo):
 * burbujas agrupadas por remitente y separadores de día («Hoy», «Ayer», «12 de septiembre»).
 */

export type BubblePosition = "single" | "first" | "middle" | "last";
export type DeliveryState = "sent" | "sending" | "failed";

export interface TimelineMessage {
  kind: "message";
  /** Clave estable para la lista: un envío optimista conserva su clave al confirmarse. */
  key: string;
  id: string | null;
  clientId: string | null;
  body: string;
  insertedAt: string;
  mine: boolean;
  delivery: DeliveryState;
  retryable: boolean;
  /** Posición cronológica dentro del grupo (first = arriba). Decide las esquinas de la burbuja. */
  position: BubblePosition;
  /** Mostrar la hora (última burbuja del grupo). */
  showTime: boolean;
}

export interface TimelineDaySeparator {
  kind: "day";
  key: string;
  label: string;
}

export type TimelineItem = TimelineMessage | TimelineDaySeparator;

/** Mensajes seguidos del mismo remitente con menos de esto entre ellos van en el mismo grupo. */
export const GROUP_WINDOW_MS = 5 * 60_000;

export interface BuildTimelineOptions {
  /** ¿Es mío este mensaje del servidor? */
  isMine(message: ChatMessage): boolean;
  /** id del servidor → clientId del envío optimista del que viene (para no remontar la burbuja). */
  keyAliases?: ReadonlyMap<string, string>;
  now?: number;
}

interface Entry {
  key: string;
  id: string | null;
  clientId: string | null;
  body: string;
  insertedAt: string;
  time: number;
  mine: boolean;
  delivery: DeliveryState;
  retryable: boolean;
}

/**
 * @param messages mensajes del servidor, de más nuevo a más antiguo.
 * @param outbox envíos optimistas en orden de envío (siempre abajo del todo).
 */
export function buildTimeline(
  messages: readonly ChatMessage[],
  outbox: readonly OutgoingMessage[],
  { isMine, keyAliases, now = Date.now() }: BuildTimelineOptions
): TimelineItem[] {
  // Cronológico (antiguo → nuevo): historial del servidor y, detrás, la cola optimista.
  const chronological: Entry[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    chronological.push({
      key: keyAliases?.get(message.id) ?? message.id,
      id: message.id,
      clientId: keyAliases?.get(message.id) ?? null,
      body: message.body,
      insertedAt: message.insertedAt,
      time: messageTimeOrNow(message.insertedAt, now),
      mine: isMine(message),
      delivery: "sent",
      retryable: false
    });
  }

  for (const item of outbox) {
    chronological.push({
      key: item.clientId,
      id: null,
      clientId: item.clientId,
      body: item.body,
      insertedAt: item.createdAt,
      time: messageTimeOrNow(item.createdAt, now),
      mine: true,
      delivery: item.status,
      retryable: item.retryable
    });
  }

  const timeline: TimelineItem[] = [];

  // Recorremos de nuevo a antiguo (orden de la lista invertida).
  for (let index = chronological.length - 1; index >= 0; index -= 1) {
    const entry = chronological[index]!;
    const newer = chronological[index + 1];
    const older = chronological[index - 1];

    const joinsOlder = older !== undefined && sameGroup(older, entry);
    const joinsNewer = newer !== undefined && sameGroup(entry, newer);

    timeline.push({
      kind: "message",
      key: entry.key,
      id: entry.id,
      clientId: entry.clientId,
      body: entry.body,
      insertedAt: entry.insertedAt,
      mine: entry.mine,
      delivery: entry.delivery,
      retryable: entry.retryable,
      position: positionFor(joinsOlder, joinsNewer),
      showTime: !joinsNewer || entry.delivery !== "sent"
    });

    const dayKey = localDayKey(entry.time);
    if (older === undefined || localDayKey(older.time) !== dayKey) {
      timeline.push({
        kind: "day",
        key: `day-${dayKey}`,
        label: formatDaySeparator(entry.time, now)
      });
    }
  }

  return timeline;
}

function messageTimeOrNow(iso: string, now: number): number {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? now : time;
}

function sameGroup(older: Entry, newer: Entry): boolean {
  return (
    older.mine === newer.mine &&
    localDayKey(older.time) === localDayKey(newer.time) &&
    newer.time - older.time <= GROUP_WINDOW_MS
  );
}

function positionFor(joinsOlder: boolean, joinsNewer: boolean): BubblePosition {
  if (joinsOlder && joinsNewer) {
    return "middle";
  }

  if (joinsOlder) {
    return "last";
  }

  if (joinsNewer) {
    return "first";
  }

  return "single";
}
