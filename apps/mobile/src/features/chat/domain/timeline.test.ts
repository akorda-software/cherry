import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@cherry/contracts";

import type { OutgoingMessage } from "./chat-messages";
import { buildTimeline, type TimelineMessage } from "./timeline";

const ME = "me";
const OTHER = "other";
const now = new Date(2026, 8, 29, 18, 0).getTime();

function at(day: number, hour: number, minute: number): string {
  return new Date(2026, 8, day, hour, minute).toISOString();
}

function msg(id: string, sender: string, insertedAt: string): ChatMessage {
  return { id, conversationId: "c1", senderProfileId: sender, body: `body ${id}`, insertedAt };
}

const isMine = (message: ChatMessage) => message.senderProfileId === ME;

function messagesOf(items: ReturnType<typeof buildTimeline>): TimelineMessage[] {
  return items.filter((item): item is TimelineMessage => item.kind === "message");
}

describe("buildTimeline", () => {
  it("returns an empty list for an empty conversation", () => {
    expect(buildTimeline([], [], { isMine, now })).toEqual([]);
  });

  it("emits items newest first with the day separator after (above) each day", () => {
    const messages = [msg("m3", OTHER, at(29, 10, 0)), msg("m2", ME, at(28, 22, 0)), msg("m1", OTHER, at(12, 9, 0))];

    const timeline = buildTimeline(messages, [], { isMine, now });

    expect(timeline.map((item) => (item.kind === "day" ? `[${item.label}]` : item.key))).toEqual([
      "m3",
      "[Hoy]",
      "m2",
      "[Ayer]",
      "m1",
      "[12 de septiembre]"
    ]);
  });

  it("groups consecutive messages from the same sender within five minutes", () => {
    const messages = [
      msg("m5", OTHER, at(29, 10, 20)),
      msg("m4", ME, at(29, 10, 9)),
      msg("m3", ME, at(29, 10, 2)),
      msg("m2", ME, at(29, 10, 1)),
      msg("m1", ME, at(29, 10, 0))
    ];

    const byKey = Object.fromEntries(messagesOf(buildTimeline(messages, [], { isMine, now })).map((m) => [m.key, m]));

    expect(byKey.m1).toMatchObject({ position: "first", showTime: false, mine: true });
    expect(byKey.m2).toMatchObject({ position: "middle", showTime: false });
    expect(byKey.m3).toMatchObject({ position: "last", showTime: true });
    // 7 minutos después: grupo nuevo.
    expect(byKey.m4).toMatchObject({ position: "single", showTime: true });
    expect(byKey.m5).toMatchObject({ position: "single", mine: false });
  });

  it("never groups across days", () => {
    const messages = [msg("b", ME, at(29, 0, 1)), msg("a", ME, at(28, 23, 59))];
    const [b, , a] = buildTimeline(messages, [], { isMine, now });
    expect(b).toMatchObject({ key: "b", position: "single" });
    expect(a).toMatchObject({ key: "a", position: "single" });
  });

  it("appends pending and failed sends at the bottom, grouped with my last messages", () => {
    const messages = [msg("m1", ME, at(29, 17, 59))];
    const outbox: OutgoingMessage[] = [
      {
        clientId: "c1",
        conversationId: "c1",
        body: "enviando",
        createdAt: new Date(now).toISOString(),
        status: "sending",
        attempts: 1,
        ambiguous: false,
        retryable: true
      },
      {
        clientId: "c2",
        conversationId: "c1",
        body: "fallido",
        createdAt: new Date(now + 1000).toISOString(),
        status: "failed",
        attempts: 2,
        ambiguous: false,
        retryable: true
      }
    ];

    const [failed, sending, sent] = messagesOf(buildTimeline(messages, outbox, { isMine, now }));

    expect(failed).toMatchObject({ key: "c2", delivery: "failed", retryable: true, position: "last", showTime: true });
    expect(sending).toMatchObject({ key: "c1", delivery: "sending", position: "middle", showTime: true });
    expect(sent).toMatchObject({ key: "m1", delivery: "sent", position: "first", showTime: false });
  });

  it("keeps the optimistic key after confirmation so the bubble does not remount", () => {
    const messages = [msg("server-1", ME, at(29, 17, 0))];
    const [item] = messagesOf(
      buildTimeline(messages, [], { isMine, now, keyAliases: new Map([["server-1", "client-1"]]) })
    );
    expect(item).toMatchObject({ key: "client-1", id: "server-1", clientId: "client-1" });
  });
});
