import { describe, expect, it } from "vitest";

import { buildChatsListItems, chatsItemKey, chatsItemType } from "./chats-list-model";
import { makeMatch } from "./testing/match-fixture";

describe("Chats list presentation model", () => {
  it("keeps section order, original match references and stable keys after prepending/appending", () => {
    const newMatches = [makeMatch("new", { lastMessage: null })];
    const conversations = [makeMatch("b"), makeMatch("a")];
    const rows = buildChatsListItems(newMatches, conversations);
    expect(rows.map(chatsItemType)).toEqual(["new-matches", "heading", "conversation", "conversation"]);
    expect(rows.map(chatsItemKey)).toEqual(["new-matches", "conversations-heading", "conversation-b", "conversation-a"]);
    expect(rows[0]).toMatchObject({ matches: newMatches });
    expect(rows[2]).toMatchObject({ match: conversations[0], first: true, last: false });
    expect(rows[3]).toMatchObject({ match: conversations[1], first: false, last: true });
    if (rows[2]?.type === "conversation") expect(rows[2].match).toBe(conversations[0]);
    const extended = buildChatsListItems(newMatches, [makeMatch("c"), ...conversations, makeMatch("d")]);
    expect(extended[3]?.key).toBe(rows[2]?.key);
    expect(conversations.map((match) => match.id)).toEqual(["b", "a"]);
  });

  it("has no orphaned headers; only new matches get the icebreaker", () => {
    expect(buildChatsListItems([], [])).toEqual([]);
    expect(buildChatsListItems([makeMatch("new", { lastMessage: null })], []).map(chatsItemType))
      .toEqual(["new-matches", "icebreak"]);
    expect(buildChatsListItems([], [makeMatch("a")])[1]).toMatchObject({ first: true, last: true });
  });

  it("gives every conversation its own cell, even with 10,000 matches", () => {
    const conversations = Array.from({ length: 10_000 }, (_, i) => makeMatch(String(i)));
    const rows = buildChatsListItems([], conversations);
    expect(rows).toHaveLength(10_001);
    expect(new Set(rows.map(chatsItemKey)).size).toBe(rows.length);
    expect(rows.at(-1)).toMatchObject({ match: conversations.at(-1), last: true });
  });
});
