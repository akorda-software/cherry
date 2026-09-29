import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, MatchSummary } from "@snack/contracts";

import { selectMatchByConversationId, useMatchesStore } from "./matches-store";

const T0 = Date.parse("2026-09-29T12:00:00Z");

function iso(offsetMs: number): string {
  return new Date(T0 + offsetMs).toISOString();
}

function message(id: string, conversationId: string, sender: string, offsetMs: number): ChatMessage {
  return { id, conversationId, senderProfileId: sender, body: `body ${id}`, insertedAt: iso(offsetMs) };
}

function match(id: string, overrides: Partial<MatchSummary> = {}): MatchSummary {
  return {
    id,
    conversationId: `conv-${id}`,
    matchedAt: iso(-86_400_000),
    expiresAt: null,
    firstMessageAt: null,
    otherProfile: { id: `other-${id}`, displayName: id, age: 30, photoUrl: null },
    lastMessage: null,
    unreadCount: 0,
    ...overrides
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const store = () => useMatchesStore.getState();

beforeEach(() => {
  store().reset();
});

describe("matches store · carga", () => {
  it("loads with a loading state and sorts by activity", async () => {
    const fetchMatches = vi.fn(async () => [
      match("a", { matchedAt: iso(-5000) }),
      match("b", { lastMessage: message("m", "conv-b", "other-b", -1000) })
    ]);

    const promise = store().load(fetchMatches);
    expect(store().status).toBe("loading");
    await promise;

    expect(store().status).toBe("ready");
    expect(store().matches.map((m) => m.id)).toEqual(["b", "a"]);
    expect(store().lastLoadedAt).not.toBeNull();
  });

  it("shares one request between concurrent loads", async () => {
    const pending = deferred<MatchSummary[]>();
    const fetchMatches = vi.fn(() => pending.promise);

    const first = store().load(fetchMatches);
    const second = store().load(fetchMatches, "silent");
    pending.resolve([match("a")]);
    await Promise.all([first, second]);

    expect(fetchMatches).toHaveBeenCalledTimes(1);
  });

  it("uses the refreshing flag for pull to refresh and keeps the list", async () => {
    await store().load(async () => [match("a")]);
    const pending = deferred<MatchSummary[]>();

    const refresh = store().load(() => pending.promise, "refresh");
    expect(store().refreshing).toBe(true);
    expect(store().status).toBe("ready");
    expect(store().matches).toHaveLength(1);

    pending.resolve([match("a"), match("b")]);
    await refresh;
    expect(store().refreshing).toBe(false);
    expect(store().matches).toHaveLength(2);
  });

  it("ends in error when the first load fails, but keeps the list on later failures", async () => {
    const boom = new TypeError("offline");
    await store().load(async () => {
      throw boom;
    });
    expect(store()).toMatchObject({ status: "error", error: boom });

    await store().load(async () => [match("a")]);
    await store().load(async () => {
      throw boom;
    }, "refresh");
    expect(store()).toMatchObject({ status: "ready", error: boom, refreshing: false });
    expect(store().matches).toHaveLength(1);
  });

  it("does not let a stale response resurrect an unmatched match or drop a fresher message", async () => {
    await store().load(async () => [match("a"), match("b")]);
    const pending = deferred<MatchSummary[]>();
    const loading = store().load(() => pending.promise, "silent");

    store().removeMatch("a");
    const fresh = message("new", "conv-b", "me", 5000);
    store().applyMessage("conv-b", fresh, { read: true });

    pending.resolve([match("a"), match("b")]);
    await loading;

    expect(store().matches.map((m) => m.id)).toEqual(["b"]);
    expect(store().matches[0]!.lastMessage?.id).toBe("new");
  });

  it("ignores a response that lands after a reset (sign out)", async () => {
    const pending = deferred<MatchSummary[]>();
    const loading = store().load(() => pending.promise);
    store().reset();
    pending.resolve([match("a")]);
    await loading;

    expect(store()).toMatchObject({ status: "idle", matches: [] });
  });
});

describe("matches store · parches en vivo", () => {
  it("adds a just-created match once", () => {
    const created = {
      id: "m1",
      conversationId: "c1",
      matchedAt: iso(0),
      expiresAt: iso(30 * 86_400_000),
      otherProfile: { id: "o1", displayName: "Lucía", age: 29, photoUrl: null }
    };

    store().addFromDiscoveryMatch(created);
    store().addFromDiscoveryMatch(created);

    expect(store().matches).toHaveLength(1);
    expect(selectMatchByConversationId("c1")(store())?.id).toBe("m1");
  });

  it("applies messages and read state per conversation", async () => {
    await store().load(async () => [match("a"), match("b")]);

    store().applyMessage("conv-a", message("x", "conv-a", "other-a", 1000), { read: false });
    expect(store().matches[0]).toMatchObject({ id: "a", unreadCount: 1, lastMessage: { id: "x" } });

    store().markRead("conv-a");
    expect(store().matches[0]!.unreadCount).toBe(0);
  });

  it("keeps the same array when nothing changes", async () => {
    await store().load(async () => [match("a")]);
    const before = store().matches;
    store().markRead("conv-a");
    store().applyMessage("conv-zzz", message("x", "conv-zzz", "o", 0), { read: false });
    expect(store().matches).toBe(before);
  });

  it("removes a match after unmatching", async () => {
    await store().load(async () => [match("a"), match("b")]);
    store().removeMatch("a");
    expect(store().matches.map((m) => m.id)).toEqual(["b"]);
  });
});
