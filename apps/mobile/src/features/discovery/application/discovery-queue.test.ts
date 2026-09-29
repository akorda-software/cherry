import { describe, expect, it, vi } from "vitest";

import type {
  DiscoveryActionResponse,
  DiscoveryFeedPage,
  DiscoveryProfileCard,
  DiscoveryUndoResponse
} from "@snack/contracts";

import { createDiscoveryQueue, type DiscoveryQueueDeps } from "./discovery-queue";

function card(id: string, overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id,
    displayName: `Persona ${id}`,
    age: 30,
    bio: "Hola",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 10,
    sharedTagsCount: 0,
    photoUrl: `https://img/${id}-1.jpg`,
    photoCount: 2,
    photos: [
      { id: `${id}-a`, url: `https://img/${id}-1.jpg`, position: 1 },
      { id: `${id}-b`, url: `https://img/${id}-2.jpg`, position: 2 }
    ],
    tags: [],
    likedYou: false,
    isNewcomer: false,
    beyondPreferredDistance: false,
    ...overrides
  };
}

function cards(...ids: string[]) {
  return ids.map((id) => card(id));
}

function page(profiles: DiscoveryProfileCard[], nextCursor: string | null): DiscoveryFeedPage {
  return { profiles, nextCursor };
}

function apiError(status: number, code?: string, body?: unknown) {
  const error = new Error(code ?? `status ${status}`) as Error & { status: number; code?: string; body?: unknown };
  error.status = status;
  error.code = code;
  error.body = body ?? (code ? { error: code } : undefined);
  return error;
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

function setup(overrides: Partial<DiscoveryQueueDeps> = {}) {
  const deps: DiscoveryQueueDeps = {
    fetchPage: vi.fn(async () => page(cards("a", "b", "c"), null)),
    recordAction: vi.fn(async (): Promise<DiscoveryActionResponse> => ({ matchCreated: false })),
    undo: vi.fn(async (): Promise<DiscoveryUndoResponse> => {
      throw apiError(422, "nothing_to_undo");
    }),
    prefetchImages: vi.fn(),
    onMatch: vi.fn(),
    ...overrides
  };
  const store = createDiscoveryQueue(deps);
  return { store, deps, ids: () => store.getState().profiles.map((profile) => profile.id) };
}

describe("discovery queue: loading", () => {
  it("loads the first page and becomes ready", async () => {
    const { store, deps, ids } = setup();

    const loading = store.getState().load();
    expect(store.getState().status).toBe("loading");
    await loading;

    expect(store.getState().status).toBe("ready");
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(store.getState().hasMore).toBe(false);
    expect(deps.fetchPage).toHaveBeenCalledWith(null);
  });

  it("maps 403 profile_paused to the paused state", async () => {
    const { store } = setup({
      fetchPage: vi.fn(async () => {
        throw apiError(403, "profile_paused");
      })
    });

    await store.getState().load();

    expect(store.getState().status).toBe("paused");
  });

  it("maps 403 profile_incomplete to the onboarding state with its next step", async () => {
    const { store } = setup({
      fetchPage: vi.fn(async () => {
        throw apiError(403, "profile_incomplete", {
          error: "profile_incomplete",
          onboardingRequired: true,
          nextOnboardingStep: "photos"
        });
      })
    });

    await store.getState().load();

    expect(store.getState().status).toBe("incomplete");
    expect(store.getState().nextOnboardingStep).toBe("photos");
  });

  it("shows a friendly error (never a raw code) when the feed fails", async () => {
    const { store } = setup({
      fetchPage: vi.fn(async () => {
        throw apiError(500);
      })
    });

    await store.getState().load();

    expect(store.getState().status).toBe("error");
    expect(store.getState().error).toMatch(/nuestra parte/);
  });

  it("prefetches the next page when 5 or fewer cards remain", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(cards("a", "b", "c", "d", "e", "f", "g"), "c2"))
      .mockResolvedValueOnce(page(cards("h", "i"), null));
    const { store, ids } = setup({ fetchPage });

    await store.getState().load();
    expect(fetchPage).toHaveBeenCalledTimes(1);

    await store.getState().act(card("a"), "dislike");
    expect(fetchPage).toHaveBeenCalledTimes(1);

    await store.getState().act(card("b"), "dislike");
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage).toHaveBeenLastCalledWith("c2");
    await vi.waitFor(() => expect(ids()).toEqual(["c", "d", "e", "f", "g", "h", "i"]));
    expect(store.getState().hasMore).toBe(false);
  });

  it("never re-adds decided or duplicated profiles from later pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(cards("a", "b"), "c2"))
      .mockResolvedValueOnce(page(cards("a", "b", "c"), null));
    const { store, ids } = setup({ fetchPage });

    await store.getState().load();
    await vi.waitFor(() => expect(store.getState().loadingMore).toBe(false));
    await vi.waitFor(() => expect(ids()).toEqual(["a", "b", "c"]));

    const fetchAgain = setup({
      fetchPage: vi
        .fn()
        .mockResolvedValueOnce(page(cards("x", "y"), "c2"))
        .mockResolvedValueOnce(page(cards("x", "z"), null))
    });
    // 'x' decided before the next page lands → never comes back.
    const loading = fetchAgain.store.getState().load();
    await loading;
    await fetchAgain.store.getState().act(card("x"), "like");
    await vi.waitFor(() => expect(fetchAgain.store.getState().hasMore).toBe(false));
    expect(fetchAgain.ids()).toEqual(["y", "z"]);
  });

  it("restarts pagination without emptying the pile when the cursor expired", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(cards("a", "b"), "old"))
      .mockRejectedValueOnce(apiError(422, "invalid_cursor"))
      .mockResolvedValueOnce(page(cards("a", "b", "c"), null));
    const { store, ids } = setup({ fetchPage });

    await store.getState().load();
    await vi.waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(store.getState().loadingMore).toBe(false));

    expect(fetchPage).toHaveBeenNthCalledWith(3, null);
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(store.getState().status).toBe("ready");
  });

  it("flags a failed next page so the UI can offer a retry", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page(cards("a"), "c2"))
      .mockRejectedValueOnce(apiError(0));
    const { store } = setup({ fetchPage });

    await store.getState().load();
    await vi.waitFor(() => expect(store.getState().loadMoreFailed).toBe(true));
    expect(store.getState().status).toBe("ready");
  });

  it("ignores a stale response when a newer load started", async () => {
    const first = deferred<DiscoveryFeedPage>();
    const fetchPage = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page(cards("new"), null));
    const { store, ids } = setup({ fetchPage });

    const stale = store.getState().load();
    await store.getState().load();
    first.resolve(page(cards("old"), null));
    await stale;

    expect(ids()).toEqual(["new"]);
  });

  it("prefetches every photo of the next two cards and the cover of the rest", async () => {
    const { store, deps } = setup({
      fetchPage: vi.fn(async () => page(cards("a", "b", "c"), null))
    });

    await store.getState().load();

    expect(deps.prefetchImages).toHaveBeenCalledWith([
      "https://img/a-1.jpg",
      "https://img/a-2.jpg",
      "https://img/b-1.jpg",
      "https://img/b-2.jpg",
      "https://img/c-1.jpg"
    ]);

    await store.getState().act(card("a"), "like");
    expect(deps.prefetchImages).toHaveBeenLastCalledWith(["https://img/c-2.jpg"]);
  });
});

describe("discovery queue: acting", () => {
  it("removes the card optimistically and keeps it out on success", async () => {
    const request = deferred<DiscoveryActionResponse>();
    const { store, ids, deps } = setup({ recordAction: vi.fn(() => request.promise) });
    await store.getState().load();

    const acting = store.getState().act(card("a"), "like");
    expect(ids()).toEqual(["b", "c"]);
    expect(store.getState().pending).toEqual({ a: "like" });
    expect(store.getState().lastRemoval).toMatchObject({ profileId: "a", action: "like", index: 0 });

    request.resolve({ matchCreated: false });
    await expect(acting).resolves.toEqual({ status: "recorded", response: { matchCreated: false } });
    expect(ids()).toEqual(["b", "c"]);
    expect(store.getState().pending).toEqual({});
    expect(deps.recordAction).toHaveBeenCalledWith({ targetProfileId: "a", actionType: "like" });
  });

  it("launches the match celebration on a mutual like", async () => {
    const match = {
      id: "m1",
      conversationId: "c1",
      matchedAt: "2026-09-29T10:00:00Z",
      expiresAt: "2026-10-29T10:00:00Z",
      otherProfile: { id: "a", displayName: "Lucía", age: 29, photoUrl: null }
    };
    const { store, deps } = setup({
      recordAction: vi.fn(async (): Promise<DiscoveryActionResponse> => ({ matchCreated: true, match }))
    });
    await store.getState().load();

    await store.getState().act(card("a"), "like");

    expect(deps.onMatch).toHaveBeenCalledWith(match);
  });

  it("rolls the card back to its place with a friendly notice when the network fails", async () => {
    const { store, ids } = setup({
      recordAction: vi.fn(async () => {
        throw apiError(0);
      })
    });
    await store.getState().load();

    const result = await store.getState().act(card("b"), "like");

    expect(result.status).toBe("rolled_back");
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(store.getState().notice).toMatchObject({ kind: "action_failed", profileId: "b" });
    expect(store.getState().notice?.message).toMatch(/conexión/);
    expect(store.getState().lastReturn).toMatchObject({ profileId: "b", reason: "rollback", action: "like" });
  });

  it("keeps the card out when the backend already has the swipe or the person is gone", async () => {
    const { store, ids } = setup({
      recordAction: vi
        .fn()
        .mockRejectedValueOnce(apiError(409, "already_swiped"))
        .mockRejectedValueOnce(apiError(404, "profile_not_found"))
    });
    await store.getState().load();

    await expect(store.getState().act(card("a"), "like")).resolves.toEqual({ status: "settled" });
    await expect(store.getState().act(card("b"), "dislike")).resolves.toEqual({ status: "settled" });

    expect(ids()).toEqual(["c"]);
    expect(store.getState().notice).toBeNull();
  });

  it("ignores a second action on a card that is still in flight", async () => {
    const request = deferred<DiscoveryActionResponse>();
    const { store, deps } = setup({ recordAction: vi.fn(() => request.promise) });
    await store.getState().load();

    const first = store.getState().act(card("a"), "like");
    await expect(store.getState().act(card("a"), "like")).resolves.toEqual({ status: "ignored" });
    request.resolve({ matchCreated: false });
    await first;

    expect(deps.recordAction).toHaveBeenCalledTimes(1);
  });

  it("removes someone without recording an action (block, report)", async () => {
    const { store, ids, deps } = setup();
    await store.getState().load();

    store.getState().remove("b");

    expect(ids()).toEqual(["a", "c"]);
    expect(store.getState().lastRemoval).toMatchObject({ profileId: "b", action: null });
    expect(deps.recordAction).not.toHaveBeenCalled();
  });
});

describe("discovery queue: undo", () => {
  it("brings the last pass back instantly and confirms with the backend", async () => {
    const undo = deferred<DiscoveryUndoResponse>();
    const { store, ids } = setup({ undo: vi.fn(() => undo.promise) });
    await store.getState().load();
    await store.getState().act(card("a"), "dislike");
    expect(store.getState().lastPass?.id).toBe("a");

    const undoing = store.getState().undo();
    await vi.waitFor(() => expect(ids()).toEqual(["a", "b", "c"]));
    expect(store.getState().lastReturn).toMatchObject({ profileId: "a", reason: "undo", action: "dislike" });

    undo.resolve({ undone: true, profile: card("a", { displayName: "Fresca" }) });
    await expect(undoing).resolves.toMatchObject({ status: "undone" });
    expect(store.getState().profiles[0]?.displayName).toBe("Fresca");
    expect(store.getState().undoing).toBe(false);
    expect(store.getState().lastPass).toBeNull();
  });

  it("waits for the in-flight pass before asking the backend", async () => {
    const request = deferred<DiscoveryActionResponse>();
    const undo = vi.fn(async (): Promise<DiscoveryUndoResponse> => ({ undone: true, profile: card("a") }));
    const { store } = setup({ recordAction: vi.fn(() => request.promise), undo });
    await store.getState().load();

    void store.getState().act(card("a"), "dislike");
    const undoing = store.getState().undo();
    expect(undo).not.toHaveBeenCalled();

    request.resolve({ matchCreated: false });
    await undoing;
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("puts back the card the backend returns even without a local pass", async () => {
    const { store, ids } = setup({
      undo: vi.fn(async (): Promise<DiscoveryUndoResponse> => ({ undone: true, profile: card("z") }))
    });
    await store.getState().load();

    await expect(store.getState().undo()).resolves.toMatchObject({ status: "undone" });

    expect(ids()).toEqual(["z", "a", "b", "c"]);
    expect(store.getState().lastReturn).toMatchObject({ profileId: "z", reason: "undo" });
  });

  it("shows a kind notice and removes the optimistic card when there is nothing to undo", async () => {
    const { store, ids } = setup();
    await store.getState().load();
    await store.getState().act(card("a"), "dislike");

    await expect(store.getState().undo()).resolves.toEqual({ status: "nothing_to_undo" });

    expect(ids()).toEqual(["b", "c"]);
    expect(store.getState().notice).toMatchObject({ kind: "nothing_to_undo" });
    expect(store.getState().notice?.message).toMatch(/10 minutos/);
    expect(store.getState().undoing).toBe(false);
  });

  it("does not offer a local undo after a like (the backend only undoes a last pass)", async () => {
    const { store } = setup();
    await store.getState().load();
    await store.getState().act(card("a"), "dislike");
    await store.getState().act(card("b"), "like");

    expect(store.getState().lastPass).toBeNull();
  });
});

describe("discovery queue: session binding", () => {
  it("empties the queue when a different user binds it", async () => {
    const { store, ids } = setup();
    store.getState().bind("user-1");
    await store.getState().load();
    expect(ids()).toHaveLength(3);

    store.getState().bind("user-1");
    expect(ids()).toHaveLength(3);

    store.getState().bind("user-2");
    expect(ids()).toEqual([]);
    expect(store.getState().status).toBe("idle");
    expect(store.getState().ownerId).toBe("user-2");
  });
});
