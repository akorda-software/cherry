import { describe, expect, it } from "vitest";

import type { ChatMessage } from "@cherry/contracts";

import {
  countCharacters,
  mergeMessages,
  pagesOverlap,
  reconcileOutbox,
  sortNewestFirst,
  validateMessageBody,
  type OutgoingMessage
} from "./chat-messages";

const T0 = Date.parse("2026-09-29T10:00:00Z");

function msg(id: string, seconds: number, body = id, sender = "other"): ChatMessage {
  return {
    id,
    conversationId: "c1",
    senderProfileId: sender,
    body,
    insertedAt: new Date(T0 + seconds * 1000).toISOString()
  };
}

function outgoing(
  clientId: string,
  body: string,
  seconds: number,
  extra: Partial<OutgoingMessage> = {}
): OutgoingMessage {
  return {
    clientId,
    conversationId: "c1",
    body,
    createdAt: new Date(T0 + seconds * 1000).toISOString(),
    status: "sending",
    attempts: 1,
    ambiguous: false,
    retryable: true,
    ...extra
  };
}

describe("validateMessageBody", () => {
  it("trims and accepts 1–2000 characters", () => {
    expect(validateMessageBody("  hola  ")).toEqual({ ok: true, body: "hola" });
    expect(validateMessageBody("a".repeat(2000))).toEqual({ ok: true, body: "a".repeat(2000) });
  });

  it("rejects empty and too long texts", () => {
    expect(validateMessageBody(" \n\t ")).toEqual({ ok: false, reason: "empty" });
    expect(validateMessageBody("a".repeat(2001))).toEqual({ ok: false, reason: "too_long" });
  });

  it("counts emoji as characters, not UTF-16 units", () => {
    expect(countCharacters("hola 👋")).toBe(6);
    expect(validateMessageBody("👋".repeat(2000)).ok).toBe(true);
  });
});

describe("sortNewestFirst", () => {
  it("sorts by time and keeps ties in input order", () => {
    const sorted = sortNewestFirst([msg("a", 1), msg("b", 3), msg("c", 3), msg("d", 2)]);
    expect(sorted.map((m) => m.id)).toEqual(["b", "c", "d", "a"]);
  });

  it("handles mixed ISO precision", () => {
    const withMs = { ...msg("ms", 0), insertedAt: "2026-09-29T10:00:05.500Z" };
    const withoutMs = { ...msg("s", 0), insertedAt: "2026-09-29T10:00:05Z" };
    expect(sortNewestFirst([withoutMs, withMs]).map((m) => m.id)).toEqual(["ms", "s"]);
  });
});

describe("mergeMessages", () => {
  it("deduplicates by id and reports only what was added", () => {
    const existing = [msg("b", 2), msg("a", 1)];
    const { messages, added } = mergeMessages(existing, [msg("c", 3), msg("b", 2), msg("c", 3)]);
    expect(messages.map((m) => m.id)).toEqual(["c", "b", "a"]);
    expect(added.map((m) => m.id)).toEqual(["c"]);
  });

  it("returns the same array when nothing is new", () => {
    const existing = [msg("a", 1)];
    expect(mergeMessages(existing, [msg("a", 1)]).messages).toBe(existing);
  });

  it("treats ties as newer for live/backfill and older for old pages", () => {
    const existing = [msg("known", 5)];
    expect(mergeMessages(existing, [msg("live", 5)], "newer").messages.map((m) => m.id)).toEqual(["live", "known"]);
    expect(mergeMessages(existing, [msg("old", 5)], "older").messages.map((m) => m.id)).toEqual(["known", "old"]);
  });
});

describe("reconcileOutbox", () => {
  it("matches own server messages with pending sends by body, oldest first", () => {
    const outbox = [outgoing("c1", "hola", 60), outgoing("c2", "hola", 61), outgoing("c3", "adiós", 62)];
    const { outbox: remaining, delivered } = reconcileOutbox(outbox, [msg("s1", 60, "hola", "me")]);

    expect(remaining.map((item) => item.clientId)).toEqual(["c2", "c3"]);
    expect([...delivered.entries()]).toEqual([["c1", "s1"]]);
  });

  it("does not match messages older than the send (beyond clock skew)", () => {
    const outbox = [outgoing("c1", "hola", 600)];
    const { outbox: remaining, delivered } = reconcileOutbox(outbox, [msg("old", 0, "hola", "me")]);
    expect(remaining).toBe(outbox);
    expect(delivered.size).toBe(0);
  });

  it("tolerates a slightly late device clock", () => {
    const outbox = [outgoing("c1", "hola", 90)];
    const { delivered } = reconcileOutbox(outbox, [msg("s1", 30, "hola", "me")]);
    expect(delivered.get("c1")).toBe("s1");
  });
});

describe("pagesOverlap", () => {
  it("detects shared ids", () => {
    expect(pagesOverlap([msg("b", 2), msg("a", 1)], [msg("c", 3), msg("b", 2)])).toBe(true);
  });

  it("detects a gap when the page starts after everything we had", () => {
    expect(pagesOverlap([msg("b", 2), msg("a", 1)], [msg("z", 900), msg("y", 800)])).toBe(false);
  });

  it("treats empty lists as overlapping", () => {
    expect(pagesOverlap([], [msg("a", 1)])).toBe(true);
    expect(pagesOverlap([msg("a", 1)], [])).toBe(true);
  });
});
