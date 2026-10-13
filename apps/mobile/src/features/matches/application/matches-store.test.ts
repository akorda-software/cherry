import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatMessage, MatchSummary } from "@cherry/contracts";

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

function load(fetchMatches: () => Promise<MatchSummary[]>, mode?: "initial" | "refresh" | "silent") {
  return store().load(async () => ({ matches: await fetchMatches(), nextCursor: null }), mode);
}

beforeEach(() => {
  store().reset();
});

describe("matches store · pagination", () => {
  it("appends a page once and preserves a newer local message", async () => {
    await store().load(async () => ({ matches: [match("a")], nextCursor: "cursor-1" }));
    const pending = deferred<{ matches: MatchSummary[]; nextCursor: string | null }>();
    const fetch = vi.fn(() => pending.promise);
    const first = store().loadMore(fetch);
    const duplicate = store().loadMore(fetch);
    store().applyMessage("conv-a", message("fresh", "conv-a", "me", 5000), { read: true });
    pending.resolve({ matches: [match("a"), match("b")], nextCursor: null });
    await Promise.all([first, duplicate]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("cursor-1");
    expect(store().matches.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(store().matches[0]!.lastMessage?.id).toBe("fresh");
    expect(store().nextCursor).toBeNull();
  });

  it("ignores an older page overtaken by a refresh", async () => {
    await store().load(async () => ({ matches: [match("a")], nextCursor: "old" }));
    const pending = deferred<{ matches: MatchSummary[]; nextCursor: string | null }>();
    const more = store().loadMore(() => pending.promise);
    await store().load(async () => ({ matches: [match("new")], nextCursor: "new-cursor" }), "refresh");
    pending.resolve({ matches: [match("obsolete")], nextCursor: null });
    await more;
    expect(store().matches.map((entry) => entry.id)).toEqual(["new"]);
    expect(store().nextCursor).toBe("new-cursor");
  });

  it("keeps the cursor after failure so loading more can retry", async () => {
    await store().load(async () => ({ matches: [match("a")], nextCursor: "retry" }));
    await store().loadMore(async () => { throw new Error("offline"); });
    expect(store()).toMatchObject({ status: "ready", nextCursor: "retry", loadingMore: false });
    await store().loadMore(async () => ({ matches: [match("b")], nextCursor: null }));
    expect(store().matches).toHaveLength(2);
  });

  it("a response from the signed-out session cannot clear a newer in-flight request", async () => {
    const old = deferred<MatchSummary[]>();
    const oldLoad = load(() => old.promise);
    store().reset();
    const fresh = deferred<MatchSummary[]>();
    const fetch = vi.fn(() => fresh.promise);
    const freshLoad = load(fetch);
    old.resolve([match("old")]);
    await oldLoad;
    const duplicate = load(fetch);
    expect(fetch).toHaveBeenCalledOnce();
    fresh.resolve([match("fresh")]);
    await Promise.all([freshLoad, duplicate]);
    expect(store().matches.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("keeps a match arriving while the first page is in flight", async () => {
    const pending = deferred<MatchSummary[]>();
    const loading = load(() => pending.promise);
    store().upsertFetchedMatch(match("just-created"));
    pending.resolve([match("existing")]);
    await loading;
    expect(store().matches).toHaveLength(2);
  });

  it("keeps an older loaded conversation made active during a first-page refresh", async () => {
    await store().load(async () => ({ matches: [match("older")], nextCursor: "more" }));
    const pending = deferred<{ matches: MatchSummary[]; nextCursor: string | null }>();
    const refreshing = store().load(() => pending.promise, "refresh");
    store().applyMessage("conv-older", message("fresh", "conv-older", "other-older", 5000), { read: false });
    pending.resolve({ matches: [match("first-page")], nextCursor: "new-cursor" });
    await refreshing;
    expect(store().matches[0]).toMatchObject({ id: "older", lastMessage: { id: "fresh" }, unreadCount: 1 });
    expect(store().nextCursor).toBe("new-cursor");
  });

  it("a refresh cannot let an earlier direct lookup resurrect an unmatched entry", async () => {
    store().upsertFetchedMatch(match("removed"));
    store().removeMatch("removed");
    await store().load(async () => ({ matches: [match("visible")], nextCursor: "more" }), "refresh");
    store().upsertFetchedMatch(match("removed"));
    expect(store().matches.map((entry) => entry.id)).toEqual(["visible"]);
  });
});

describe("matches store · carga", () => {
  it("loads with a loading state and sorts by activity", async () => {
    const fetchMatches = vi.fn(async () => [
      match("a", { matchedAt: iso(-5000) }),
      match("b", { lastMessage: message("m", "conv-b", "other-b", -1000) })
    ]);

    const promise = load(fetchMatches);
    expect(store().status).toBe("loading");
    await promise;

    expect(store().status).toBe("ready");
    expect(store().matches.map((m) => m.id)).toEqual(["b", "a"]);
    expect(store().lastLoadedAt).not.toBeNull();
  });

  it("shares one request between concurrent loads", async () => {
    const pending = deferred<MatchSummary[]>();
    const fetchMatches = vi.fn(() => pending.promise);

    const first = load(fetchMatches);
    const second = load(fetchMatches, "silent");
    pending.resolve([match("a")]);
    await Promise.all([first, second]);

    expect(fetchMatches).toHaveBeenCalledTimes(1);
  });

  it("uses the refreshing flag for pull to refresh and keeps the list", async () => {
    await load(async () => [match("a")]);
    const pending = deferred<MatchSummary[]>();

    const refresh = load(() => pending.promise, "refresh");
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
    await load(async () => {
      throw boom;
    });
    expect(store()).toMatchObject({ status: "error", error: boom });

    await load(async () => [match("a")]);
    await load(async () => {
      throw boom;
    }, "refresh");
    expect(store()).toMatchObject({ status: "ready", error: boom, refreshing: false });
    expect(store().matches).toHaveLength(1);
  });

  it("does not let a stale response resurrect an unmatched match or drop a fresher message", async () => {
    await load(async () => [match("a"), match("b")]);
    const pending = deferred<MatchSummary[]>();
    const loading = load(() => pending.promise, "silent");

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
    const loading = load(() => pending.promise);
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
    await load(async () => [match("a"), match("b")]);

    store().applyMessage("conv-a", message("x", "conv-a", "other-a", 1000), { read: false });
    expect(store().matches[0]).toMatchObject({ id: "a", unreadCount: 1, lastMessage: { id: "x" } });

    store().markRead("conv-a");
    expect(store().matches[0]!.unreadCount).toBe(0);
  });

  it("keeps the same array when nothing changes", async () => {
    await load(async () => [match("a")]);
    const before = store().matches;
    store().markRead("conv-a");
    store().applyMessage("conv-zzz", message("x", "conv-zzz", "o", 0), { read: false });
    expect(store().matches).toBe(before);
  });

  it("removes a match after unmatching", async () => {
    await load(async () => [match("a"), match("b")]);
    store().removeMatch("a");
    expect(store().matches.map((m) => m.id)).toEqual(["b"]);
  });
});
