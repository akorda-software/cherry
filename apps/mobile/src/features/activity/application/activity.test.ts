import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivitySummary } from "@snack/contracts";

import {
  ACTIVITY_POLL_INTERVAL_MS,
  acquireActivityPolling,
  refreshActivitySummary,
  resetActivityPollingForTests,
  type AppStateLike
} from "./activity-poller";
import { useTabBadgesStore } from "../../../shared/ui/app-shell/tab-badges-store";
import { chatsBadgeCount, likesBadgeCount, useActivityStore } from "./activity-store";

function summary(likes: number, matches: number, unread: number): ActivitySummary {
  return { receivedLikesCount: likes, newMatchesCount: matches, unreadConversationsCount: unread };
}

function fakeAppState(initial = "active") {
  let listener: ((state: string) => void) | null = null;
  const appState: AppStateLike & { emit(state: string): void } = {
    currentState: initial,
    addEventListener: vi.fn((_type, callback) => {
      listener = callback;
      return { remove: vi.fn(() => (listener = null)) };
    }),
    emit(state: string) {
      appState.currentState = state;
      listener?.(state);
    }
  };
  return appState;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetActivityPollingForTests();
  useActivityStore.getState().reset();
});

afterEach(() => {
  resetActivityPollingForTests();
  vi.useRealTimers();
});

describe("activity store", () => {
  it("computes the tab badges", () => {
    expect(likesBadgeCount(null)).toBe(0);
    expect(chatsBadgeCount(null)).toBe(0);
    expect(likesBadgeCount(summary(8, 2, 3))).toBe(8);
    expect(chatsBadgeCount(summary(8, 2, 3))).toBe(5);
  });

  it("adjusts optimistically without going below zero", () => {
    const store = useActivityStore.getState();
    store.adjust({ receivedLikesCount: -1 });
    expect(useActivityStore.getState().summary).toBeNull();

    store.setSummary(summary(1, 0, 2));
    store.adjust({ receivedLikesCount: -1, newMatchesCount: 1 });
    store.adjust({ receivedLikesCount: -1, unreadConversationsCount: -5 });
    expect(useActivityStore.getState().summary).toEqual(summary(0, 1, 0));
  });

  it("drives the tab bar badges", () => {
    const store = useActivityStore.getState();
    store.setSummary(summary(8, 2, 3));
    expect(useTabBadgesStore.getState()).toMatchObject({ likes: 8, chats: 5 });

    store.adjust({ receivedLikesCount: -1, unreadConversationsCount: -1 });
    expect(useTabBadgesStore.getState()).toMatchObject({ likes: 7, chats: 4 });

    store.reset();
    expect(useTabBadgesStore.getState()).toMatchObject({ likes: 0, chats: 0 });
  });

  it("keeps the same object when the server says the same", () => {
    const store = useActivityStore.getState();
    store.setSummary(summary(1, 2, 3));
    const before = useActivityStore.getState().summary;
    store.setSummary(summary(1, 2, 3));
    expect(useActivityStore.getState().summary).toBe(before);
  });
});

describe("activity polling", () => {
  it("fetches on start and then every interval while in foreground", async () => {
    const fetchSummary = vi.fn(async () => summary(3, 1, 0));
    const release = acquireActivityPolling({ fetchSummary, appState: fakeAppState() });
    await vi.advanceTimersByTimeAsync(0);

    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(useActivityStore.getState().summary).toEqual(summary(3, 1, 0));

    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS);
    expect(fetchSummary).toHaveBeenCalledTimes(2);

    release();
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS * 3);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it("shares a single poller between several screens", async () => {
    const fetchSummary = vi.fn(async () => summary(1, 0, 0));
    const releaseLikes = acquireActivityPolling({ fetchSummary, appState: fakeAppState() });
    const releaseChats = acquireActivityPolling({ fetchSummary, appState: fakeAppState() });
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    releaseLikes();
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS);
    expect(fetchSummary).toHaveBeenCalledTimes(2);

    releaseChats();
    releaseChats(); // idempotente
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it("skips ticks in background and refreshes when coming back", async () => {
    const appState = fakeAppState();
    const fetchSummary = vi.fn(async () => summary(0, 0, 1));
    acquireActivityPolling({ fetchSummary, appState });
    await vi.advanceTimersByTimeAsync(0);

    appState.emit("background");
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS * 2);
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    appState.emit("active");
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it("keeps the last badges when a request fails", async () => {
    const fetchSummary = vi
      .fn<() => Promise<ActivitySummary>>()
      .mockResolvedValueOnce(summary(2, 0, 0))
      .mockRejectedValueOnce(new TypeError("offline"));
    acquireActivityPolling({ fetchSummary, appState: fakeAppState() });
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS);

    expect(fetchSummary).toHaveBeenCalledTimes(2);
    expect(useActivityStore.getState().summary).toEqual(summary(2, 0, 0));
  });

  it("groups refreshes that come too close together, unless forced", async () => {
    const fetchSummary = vi.fn(async () => summary(0, 0, 0));
    acquireActivityPolling({ fetchSummary, appState: fakeAppState() });
    await vi.advanceTimersByTimeAsync(0);

    await refreshActivitySummary();
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    await refreshActivitySummary({ force: true });
    expect(fetchSummary).toHaveBeenCalledTimes(2);
  });

  it("never reuses or applies a request started by a previous session", async () => {
    let resolveOld!: (value: ActivitySummary) => void;
    const fetchOld = vi.fn(
      () =>
        new Promise<ActivitySummary>((resolve) => {
          resolveOld = resolve;
        })
    );
    const releaseOld = acquireActivityPolling({ fetchSummary: fetchOld, appState: fakeAppState() });
    releaseOld(); // cierre de sesión con la petición de A aún en vuelo

    const fetchNew = vi.fn(async () => summary(0, 1, 0));
    acquireActivityPolling({ fetchSummary: fetchNew, appState: fakeAppState() });
    await refreshActivitySummary({ force: true });
    expect(fetchNew).toHaveBeenCalled();
    expect(useActivityStore.getState().summary).toEqual(summary(0, 1, 0));

    resolveOld(summary(9, 9, 9));
    await vi.advanceTimersByTimeAsync(0);
    expect(useActivityStore.getState().summary).toEqual(summary(0, 1, 0));
  });

  it("does nothing when nobody is listening", async () => {
    await refreshActivitySummary({ force: true });
    expect(useActivityStore.getState().summary).toBeNull();
  });

  it("works without AppState (tests, web)", async () => {
    const fetchSummary = vi.fn(async () => summary(1, 1, 1));
    const release = acquireActivityPolling({ fetchSummary });
    await vi.advanceTimersByTimeAsync(ACTIVITY_POLL_INTERVAL_MS);
    expect(fetchSummary).toHaveBeenCalledTimes(2);
    release();
  });
});
