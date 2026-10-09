import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveryActionResponse, DiscoveryProfileCard, PublicProfile } from "@snack/contracts";

import { createDiscoveryQueue } from "./discovery-queue";
import { stageProfile, useProfileTransitStore } from "./profile-transit";
import { type FullProfileDeps, useFullProfile } from "./use-full-profile";

function card(id: string, overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id,
    displayName: "Lucía",
    age: 29,
    bio: "Hola",
    gender: "woman",
    lookingFor: ["relationship"],
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 1,
    sharedTagsCount: 1,
    photoUrl: "https://x/1.jpg",
    photoCount: 1,
    photos: [{ id: "f1", url: "https://x/1.jpg", position: 1 }],
    tags: [],
    likedYou: false,
    isNewcomer: false,
    beyondPreferredDistance: true,
    ...overrides
  };
}

function publicProfile(id: string, overrides: Partial<PublicProfile> = {}): PublicProfile {
  return {
    id,
    displayName: "Lucía Remota",
    age: 29,
    bio: "Bio fresca",
    gender: "woman",
    lookingFor: ["relationship"],
    distanceLabel: "A unos 3 km",
    distanceKmApprox: 3,
    photos: [{ id: "f1", url: "https://x/1.jpg", position: 1 }],
    tags: [],
    likedYou: true,
    youLiked: false,
    matchId: null,
    conversationId: null,
    isNewcomer: false,
    ...overrides
  };
}

function apiError(status: number, code?: string) {
  const error = new Error(code ?? "boom") as Error & { status: number; code?: string };
  error.status = status;
  error.code = code;
  return error;
}

function makeDeps(overrides: Partial<FullProfileDeps> = {}) {
  const queue = createDiscoveryQueue({
    fetchPage: vi.fn(async () => ({ profiles: [card("p1"), card("p2")], nextCursor: null })),
    recordAction: vi.fn(async (): Promise<DiscoveryActionResponse> => ({ matchCreated: false })),
    undo: vi.fn()
  });
  const deps: FullProfileDeps = {
    getProfile: vi.fn(async (id: string) => publicProfile(id)),
    recordAction: vi.fn(async (): Promise<DiscoveryActionResponse> => ({ matchCreated: false })),
    queue,
    showMatch: vi.fn(),
    ...overrides
  };
  return deps;
}

describe("useFullProfile", () => {
  beforeEach(() => {
    useProfileTransitStore.setState({ entries: {} });
  });

  it("renders the staged card instantly and refreshes it from the API", async () => {
    stageProfile(card("p1"), { origin: "discover" });
    const deps = makeDeps();

    const { result } = renderHook(() => useFullProfile("p1", deps));

    expect(result.current.status).toBe("ready");
    expect(result.current.person?.displayName).toBe("Lucía");

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.person?.displayName).toBe("Lucía Remota");
    // The public profile has no distance flag: keep the one from the feed card.
    expect(result.current.person?.beyondPreferredDistance).toBe(true);
    expect(result.current.relationship.likedYou).toBe(true);
  });

  it("shows a loading state without a staged card and a kind 404 state", async () => {
    const deps = makeDeps({
      getProfile: vi.fn(async () => {
        throw apiError(404, "profile_not_found");
      })
    });

    const { result } = renderHook(() => useFullProfile("gone", deps));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("not_found"));
  });

  it("keeps the staged card on a network error", async () => {
    stageProfile(card("p1"));
    const deps = makeDeps({
      getProfile: vi.fn(async () => {
        throw apiError(0);
      })
    });

    const { result } = renderHook(() => useFullProfile("p1", deps));

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toMatch(/conexión/);
  });

  it("delegates actions on discover cards to the queue (optimistic)", async () => {
    const onAction = vi.fn();
    stageProfile(card("p1"), { origin: "discover", onAction });
    const deps = makeDeps();
    await deps.queue.getState().load();

    const { result } = renderHook(() => useFullProfile("p1", deps));
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    let done = false;
    await act(async () => {
      done = await result.current.act("like");
    });

    expect(done).toBe(true);
    expect(deps.queue.getState().profiles.map((p) => p.id)).toEqual(["p2"]);
    expect(deps.recordAction).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith({ action: "like", response: null });
  });

  it("records actions from other origins and celebrates a match", async () => {
    const match = {
      id: "m1",
      conversationId: "c1",
      matchedAt: "2026-09-29T10:00:00Z",
      expiresAt: null,
      otherProfile: { id: "p9", displayName: "Lucía", age: 29, photoUrl: null }
    };
    const onAction = vi.fn();
    stageProfile(card("p9"), { origin: "likes", onAction });
    const deps = makeDeps({
      recordAction: vi.fn(async (): Promise<DiscoveryActionResponse> => ({ matchCreated: true, match }))
    });

    const { result } = renderHook(() => useFullProfile("p9", deps));
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    await act(async () => {
      await result.current.act("like");
    });

    expect(deps.showMatch).toHaveBeenCalledWith(match);
    expect(onAction).toHaveBeenCalledWith({ action: "like", response: { matchCreated: true, match } });
  });

  it("stays on the profile with a friendly error when the action fails", async () => {
    stageProfile(card("p9"), { origin: "likes" });
    const deps = makeDeps({
      recordAction: vi.fn(async () => {
        throw apiError(503);
      })
    });

    const { result } = renderHook(() => useFullProfile("p9", deps));
    await waitFor(() => expect(result.current.refreshing).toBe(false));

    let done = true;
    await act(async () => {
      done = await result.current.act("dislike");
    });

    expect(done).toBe(false);
    expect(result.current.actionError).toMatch(/nuestra parte/);
    expect(result.current.acting).toBeNull();
  });

  it("removes a blocked person from Descubrir", async () => {
    const onSafetyAction = vi.fn();
    stageProfile(card("p2"), { origin: "discover", onSafetyAction });
    const deps = makeDeps();
    await deps.queue.getState().load();

    const { result } = renderHook(() => useFullProfile("p2", deps));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    act(() => result.current.afterSafetyAction("blocked"));

    expect(deps.queue.getState().profiles.map((p) => p.id)).toEqual(["p1"]);
    expect(onSafetyAction).toHaveBeenCalledWith("blocked");
  });
});
