import { describe, expect, it } from "vitest";

import type { ChatMessage, MatchSummary } from "@snack/contracts";

import {
  applyMessageToMatch,
  displayNameOf,
  isOwnLastMessage,
  lastMessagePreview,
  matchExpiryHint,
  matchSummaryFromDiscoveryMatch,
  splitMatches
} from "./match-list";

const T0 = Date.parse("2026-09-29T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function iso(offsetMs: number): string {
  return new Date(T0 + offsetMs).toISOString();
}

function message(id: string, sender: string, offsetMs: number, body = `mensaje ${id}`): ChatMessage {
  return { id, conversationId: `conv-${id}`, senderProfileId: sender, body, insertedAt: iso(offsetMs) };
}

function match(id: string, overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id,
    conversationId: `conv-${id}`,
    matchedAt: iso(-DAY),
    expiresAt: iso(29 * DAY),
    firstMessageAt: null,
    otherProfile: { id: `other-${id}`, displayName: `Persona ${id}`, age: 30, photoUrl: null },
    lastMessage: null,
    unreadCount: 0,
    ...overrides
  };
}

describe("splitMatches", () => {
  it("separates new matches from conversations and sorts each section", () => {
    const sections = splitMatches([
      match("new-old", { matchedAt: iso(-3 * DAY) }),
      match("chat-old", { lastMessage: message("a", "other-chat-old", -2 * DAY) }),
      match("new-recent", { matchedAt: iso(-60_000) }),
      match("chat-recent", { lastMessage: message("b", "other-chat-recent", -60_000) })
    ]);

    expect(sections.newMatches.map((m) => m.id)).toEqual(["new-recent", "new-old"]);
    expect(sections.conversations.map((m) => m.id)).toEqual(["chat-recent", "chat-old"]);
  });
});

describe("lastMessagePreview", () => {
  it("prefixes my own last message with «Tú:» and flattens whitespace", () => {
    const mine = match("x", { lastMessage: message("m", "me", 0, "¿cenamos\n\nel   viernes?") });
    expect(isOwnLastMessage(mine)).toBe(true);
    expect(lastMessagePreview(mine)).toBe("Tú: ¿cenamos el viernes?");
  });

  it("shows their message as is", () => {
    const theirs = match("x", { lastMessage: message("m", "other-x", 0, "¡Hola!") });
    expect(isOwnLastMessage(theirs)).toBe(false);
    expect(lastMessagePreview(theirs)).toBe("¡Hola!");
  });

  it("is empty without messages", () => {
    expect(lastMessagePreview(match("x"))).toBe("");
  });
});

describe("displayNameOf", () => {
  it("falls back gracefully", () => {
    expect(displayNameOf(match("x"))).toBe("Persona x");
    expect(displayNameOf(match("x", { otherProfile: { id: "o", displayName: "  ", age: null, photoUrl: null } }))).toBe(
      "Alguien"
    );
  });
});

describe("matchExpiryHint", () => {
  it("stays quiet while there is plenty of time", () => {
    expect(matchExpiryHint(iso(12 * DAY), T0)).toBeNull();
    expect(matchExpiryHint(iso(7 * DAY + 1), T0)).toBeNull();
  });

  it("warmly counts the days when a week or less is left", () => {
    expect(matchExpiryHint(iso(7 * DAY), T0)).toMatchObject({ daysLeft: 7, short: "quedan 7 días" });
    expect(matchExpiryHint(iso(2 * DAY - 1), T0)).toMatchObject({ daysLeft: 2, short: "quedan 2 días" });
    expect(matchExpiryHint(iso(3 * 60 * 60 * 1000), T0)).toMatchObject({
      daysLeft: 1,
      short: "queda 1 día",
      accessibilityLabel: "Queda 1 día para saludar"
    });
  });

  it("returns nothing when it no longer expires or already expired", () => {
    expect(matchExpiryHint(null, T0)).toBeNull();
    expect(matchExpiryHint(iso(-1), T0)).toBeNull();
  });
});

describe("applyMessageToMatch", () => {
  it("makes the message the last one, stops the expiry and counts unread", () => {
    const base = match("x");
    const theirs = applyMessageToMatch(base, message("m1", "other-x", 1000), { read: false });
    expect(theirs).toMatchObject({ expiresAt: null, unreadCount: 1, lastMessage: { id: "m1" } });
    expect(theirs.firstMessageAt).toBe(iso(1000));

    const read = applyMessageToMatch(theirs, message("m2", "other-x", 2000), { read: true });
    expect(read.unreadCount).toBe(0);

    const mine = applyMessageToMatch(theirs, message("m3", "me", 3000), { read: false });
    expect(mine.unreadCount).toBe(0);
  });

  it("ignores older or repeated messages", () => {
    const base = match("x", { lastMessage: message("m2", "other-x", 2000), unreadCount: 1 });
    expect(applyMessageToMatch(base, message("m1", "other-x", 1000), { read: false })).toBe(base);
    expect(applyMessageToMatch(base, message("m2", "other-x", 2000), { read: false })).toBe(base);
  });
});

describe("matchSummaryFromDiscoveryMatch", () => {
  it("builds a new match without messages", () => {
    const summary = matchSummaryFromDiscoveryMatch({
      id: "m",
      conversationId: "c",
      matchedAt: iso(0),
      expiresAt: iso(30 * DAY),
      otherProfile: { id: "o", displayName: "Lucía", age: 29, photoUrl: "https://x/y.jpg" }
    });

    expect(summary).toMatchObject({ id: "m", conversationId: "c", lastMessage: null, unreadCount: 0 });
  });
});
