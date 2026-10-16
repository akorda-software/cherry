import type { ChatMessage } from "@cherry/contracts";

import type { MergeResult, OutgoingMessage } from "../chat-messages";
import { formatDaySeparator, localDayKey } from "../time-format";
import type { BuildTimelineOptions, TimelineItem } from "../timeline";

// Frozen pre-optimization algorithms, shared only by differential tests and the Node benchmark.
function messageTime(message: ChatMessage): number {
  const time = Date.parse(message.insertedAt);
  return Number.isNaN(time) ? 0 : time;
}

export function previousMergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
  tie: "newer" | "older" = "newer"
): MergeResult {
  const known = new Set(existing.map((message) => message.id));
  const added: ChatMessage[] = [];
  for (const message of incoming) {
    if (!known.has(message.id)) {
      known.add(message.id);
      added.push(message);
    }
  }
  if (added.length === 0) return { messages: existing as ChatMessage[], added };
  const combined = tie === "newer" ? [...added, ...existing] : [...existing, ...added];
  const messages = combined
    .map((message, index) => ({ message, index, time: messageTime(message) }))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map(({ message }) => message);
  return { messages, added };
}

interface Entry {
  key: string;
  id: string | null;
  clientId: string | null;
  body: string;
  insertedAt: string;
  time: number;
  mine: boolean;
  delivery: "sent" | "sending" | "failed";
  retryable: boolean;
}

export function previousBuildTimeline(
  messages: readonly ChatMessage[],
  outbox: readonly OutgoingMessage[],
  { isMine, keyAliases, now = Date.now() }: BuildTimelineOptions
): TimelineItem[] {
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
      timeline.push({ kind: "day", key: `day-${dayKey}`, label: formatDaySeparator(entry.time, now) });
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
    newer.time - older.time <= 5 * 60_000
  );
}

function positionFor(joinsOlder: boolean, joinsNewer: boolean): "single" | "first" | "middle" | "last" {
  if (joinsOlder && joinsNewer) return "middle";
  if (joinsOlder) return "last";
  if (joinsNewer) return "first";
  return "single";
}
