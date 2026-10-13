import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DiscoveryActionResponse,
  DiscoveryMatch,
  DiscoveryProfileCard,
  DiscoveryUndoResponse,
  ReceivedLike,
  ReceivedLikesPage
} from "@cherry/contracts";

import { useReceivedLikesStore, type ReceivedLikesDeps } from "./received-likes-store";

function card(id: string): DiscoveryProfileCard {
  return {
    id,
    displayName: `Persona ${id}`,
    age: 30,
    bio: null,
    gender: "woman",
    lookingFor: ["relationship"],
    distanceLabel: null,
    distanceKmApprox: null,
    score: 0,
    sharedTagsCount: 2,
    photoUrl: null,
    photoCount: 0,
    photos: [],
    tags: [],
    likedYou: true,
    isNewcomer: false,
    beyondPreferredDistance: false
  };
}

function like(id: string): ReceivedLike {
  return { likedAt: "2026-09-29T10:00:00Z", profile: card(id) };
}

function page(ids: string[], nextCursor: string | null = null): ReceivedLikesPage {
  return { likes: ids.map(like), nextCursor };
}

function apiError(status: number, code: string): Error {
  return Object.assign(new Error(code), { status, code });
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

const MATCH: DiscoveryMatch = {
  id: "match-1",
  conversationId: "conv-1",
  matchedAt: "2026-09-29T10:00:00Z",
  expiresAt: "2026-10-29T10:00:00Z",
  otherProfile: { id: "b", displayName: "Persona b", age: 30, photoUrl: null }
};

function makeDeps() {
  return {
    fetchPage: vi.fn<ReceivedLikesDeps["fetchPage"]>().mockResolvedValue(page(["a", "b", "c"], "cursor-2")),
    recordAction: vi
      .fn<ReceivedLikesDeps["recordAction"]>()
      .mockResolvedValue({ matchCreated: false } as DiscoveryActionResponse),
    undo: vi.fn<ReceivedLikesDeps["undo"]>(),
    onMatch: vi.fn(),
    onCountDelta: vi.fn()
  };
}

const store = () => useReceivedLikesStore.getState();
const ids = () => store().likes.map((entry) => entry.profile.id);

beforeEach(() => {
  store().reset();
});

describe("likes · carga y paginación", () => {
  it("loads the first page", async () => {
    const deps = makeDeps();
    const loading = store().load(deps);
    expect(store().status).toBe("loading");
    await loading;

    expect(deps.fetchPage).toHaveBeenCalledWith(null);
    expect(store()).toMatchObject({ status: "ready", hasMore: true, nextCursor: "cursor-2" });
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("appends the next page without duplicates and stops at the end", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.fetchPage.mockResolvedValueOnce(page(["c", "d"], null));

    await store().loadMore(deps);
    expect(deps.fetchPage).toHaveBeenLastCalledWith("cursor-2");
    expect(ids()).toEqual(["a", "b", "c", "d"]);
    expect(store().hasMore).toBe(false);

    await store().loadMore(deps);
    expect(deps.fetchPage).toHaveBeenCalledTimes(2);
  });

  it("restarts without cursor when it expired", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.fetchPage.mockRejectedValueOnce(apiError(422, "invalid_cursor")).mockResolvedValueOnce(page(["a", "b"], null));

    await store().loadMore(deps);

    expect(deps.fetchPage).toHaveBeenLastCalledWith(null);
    expect(ids()).toEqual(["a", "b"]);
  });

  it("shows the error state on first load and a notice on a failed refresh", async () => {
    const deps = makeDeps();
    deps.fetchPage.mockRejectedValueOnce(new TypeError("offline"));
    await store().load(deps);
    expect(store().status).toBe("error");

    await store().load(deps);
    expect(store().status).toBe("ready");

    deps.fetchPage.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    await store().load(deps, "refresh");
    expect(store()).toMatchObject({ status: "ready", refreshing: false });
    expect(store().notice).toMatchObject({ tone: "error" });
    expect(ids()).toEqual(["a", "b", "c"]);
  });
});

describe("likes · responder", () => {
  it("likes back: removes the card, reports the match and adjusts the badge", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.recordAction.mockResolvedValueOnce({ matchCreated: true, match: MATCH });

    const result = await store().respond(deps, "b", "like");

    expect(deps.recordAction).toHaveBeenCalledWith({ targetProfileId: "b", actionType: "like" });
    expect(result).toEqual({ kind: "match", match: MATCH });
    expect(deps.onMatch).toHaveBeenCalledWith(MATCH);
    expect(deps.onCountDelta).toHaveBeenCalledWith(-1);
    expect(ids()).toEqual(["a", "c"]);
    expect(store().lastPass).toBeNull();
  });

  it("removes the card optimistically before the server answers", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);

    const responding = store().respond(deps, "a", "like");
    expect(ids()).toEqual(["b", "c"]);
    expect(store().pending).toEqual({ a: "like" });

    // Una segunda pulsación no hace nada.
    expect(await store().respond(deps, "a", "like")).toEqual({ kind: "ignored" });

    pending.resolve({ matchCreated: true, match: MATCH });
    await responding;
    expect(store().pending).toEqual({});
  });

  it("brings the card back where it was when the answer fails", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.recordAction.mockRejectedValueOnce(new TypeError("Network request failed"));

    const result = await store().respond(deps, "b", "like");

    expect(result.kind).toBe("failed");
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(deps.onCountDelta).toHaveBeenNthCalledWith(1, -1);
    expect(deps.onCountDelta).toHaveBeenNthCalledWith(2, 1);
    expect(store().notice).toMatchObject({ tone: "error" });
  });

  it("rolls back when recording the answer throws synchronously", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.recordAction.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const result = await store().respond(deps, "b", "dislike");

    expect(result.kind).toBe("failed");
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(store().pending).toEqual({});
    expect(store().lastPass).toBeNull();
    expect(deps.onCountDelta).toHaveBeenNthCalledWith(1, -1);
    expect(deps.onCountDelta).toHaveBeenNthCalledWith(2, 1);
    expect(store().notice).toMatchObject({ tone: "error" });
  });

  it("keeps the card out when it was already answered elsewhere", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.recordAction.mockRejectedValueOnce(apiError(409, "already_swiped"));

    expect(await store().respond(deps, "a", "like")).toEqual({ kind: "done" });
    expect(ids()).toEqual(["b", "c"]);
  });

  it("explains when the profile is gone", async () => {
    const deps = makeDeps();
    await store().load(deps);
    deps.recordAction.mockRejectedValueOnce(apiError(404, "profile_not_found"));

    expect(await store().respond(deps, "a", "dislike")).toEqual({ kind: "gone" });
    expect(ids()).toEqual(["b", "c"]);
    expect(store().notice).toMatchObject({ tone: "info", message: "Este perfil ya no está disponible." });
    expect(store().lastPass).toBeNull();
  });

  it("ignores unknown profiles", async () => {
    const deps = makeDeps();
    await store().load(deps);
    expect(await store().respond(deps, "zzz", "like")).toEqual({ kind: "ignored" });
    expect(deps.recordAction).not.toHaveBeenCalled();
  });

  it("does not bring back answered people on a refresh that raced the answer", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);

    const responding = store().respond(deps, "a", "dislike");
    await store().load(deps, "refresh"); // el servidor aún devuelve a «a»
    expect(ids()).toEqual(["b", "c"]);

    pending.resolve({ matchCreated: false });
    await responding;
  });
});

describe("likes · deshacer el «no»", () => {
  it("offers undo after a pass and restores the card in place", async () => {
    const deps = makeDeps();
    await store().load(deps);
    await store().respond(deps, "b", "dislike");
    expect(store().lastPass?.like.profile.id).toBe("b");

    deps.undo.mockResolvedValueOnce({ undone: true, profile: card("b") } as DiscoveryUndoResponse);
    expect(await store().undoPass(deps)).toBe(true);

    expect(ids()).toEqual(["a", "b", "c"]);
    expect(store().lastPass).toBeNull();
    expect(deps.onCountDelta).toHaveBeenLastCalledWith(1);
  });

  it("waits for the pass to reach the server before undoing it", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);
    deps.undo.mockResolvedValueOnce({ undone: true, profile: card("a") } as DiscoveryUndoResponse);

    void store().respond(deps, "a", "dislike");
    const undoing = store().undoPass(deps);
    expect(store().undoing).toBe(true);
    expect(deps.undo).not.toHaveBeenCalled();

    pending.resolve({ matchCreated: false });
    expect(await undoing).toBe(true);
    expect(deps.undo).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("has nothing to undo if the pass itself failed", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);

    void store().respond(deps, "a", "dislike");
    const undoing = store().undoPass(deps);
    pending.reject(new TypeError("offline"));

    expect(await undoing).toBe(false);
    expect(deps.undo).not.toHaveBeenCalled();
    expect(ids()).toEqual(["a", "b", "c"]);
  });

  it("a like invalidates the previous undo", async () => {
    const deps = makeDeps();
    await store().load(deps);
    await store().respond(deps, "a", "dislike");
    await store().respond(deps, "b", "like");
    expect(store().lastPass).toBeNull();
    expect(await store().undoPass(deps)).toBe(false);
  });

  it("undoes kindly when that person is no longer available", async () => {
    const deps = makeDeps();
    await store().load(deps);
    await store().respond(deps, "b", "dislike");
    deps.undo.mockResolvedValueOnce({ undone: true, profile: null } as unknown as DiscoveryUndoResponse);

    expect(await store().undoPass(deps)).toBe(true);
    expect(ids()).toEqual(["a", "c"]);
    expect(store().lastPass).toBeNull();
    expect(store().notice).toMatchObject({ tone: "info", message: "Deshecho, pero esa persona ya no está disponible." });
    expect(deps.onCountDelta).toHaveBeenLastCalledWith(-1);
  });

  it("explains when it is too late to undo", async () => {
    const deps = makeDeps();
    await store().load(deps);
    await store().respond(deps, "a", "dislike");
    deps.undo.mockRejectedValueOnce(apiError(422, "nothing_to_undo"));

    expect(await store().undoPass(deps)).toBe(false);
    expect(store().notice).toMatchObject({ tone: "info", message: "Ya no se puede deshacer." });
    expect(ids()).toEqual(["b", "c"]);
  });

  it("dismisses the undo toast", async () => {
    const deps = makeDeps();
    await store().load(deps);
    await store().respond(deps, "a", "dislike");
    store().dismissUndo();
    expect(store().lastPass).toBeNull();
  });
});

describe("likes · otros", () => {
  it("removes a profile answered from another screen", async () => {
    const deps = makeDeps();
    await store().load(deps);
    store().removeProfile("a");
    expect(ids()).toEqual(["b", "c"]);
  });

  it("drops a match that lands after the session changed", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);

    const responding = store().respond(deps, "b", "like");
    store().reset();
    pending.resolve({ matchCreated: true, match: MATCH });

    expect(await responding).toEqual({ kind: "ignored" });
    expect(deps.onMatch).not.toHaveBeenCalled();
    expect(store()).toMatchObject({ likes: [], pending: {}, notice: null });
  });

  it("does not roll back into another session when the answer fails late", async () => {
    const deps = makeDeps();
    await store().load(deps);
    const pending = deferred<DiscoveryActionResponse>();
    deps.recordAction.mockReturnValueOnce(pending.promise);

    const responding = store().respond(deps, "b", "like");
    store().reset();
    pending.reject(new TypeError("offline"));

    expect(await responding).toEqual({ kind: "ignored" });
    expect(store()).toMatchObject({ likes: [], notice: null });
    expect(deps.onCountDelta).toHaveBeenCalledTimes(1);
  });

  it("ignores responses that land after a reset", async () => {
    const deps = makeDeps();
    const pending = deferred<ReceivedLikesPage>();
    deps.fetchPage.mockReturnValueOnce(pending.promise);

    const loading = store().load(deps);
    store().reset();
    pending.resolve(page(["a"]));
    await loading;

    expect(store()).toMatchObject({ status: "idle", likes: [] });
  });
});
