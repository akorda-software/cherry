import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  DiscoveryActionResponse,
  DiscoveryFeedPage,
  DiscoveryProfileCard
} from "@cherry/contracts";

import { useDiscoveryFeed } from "./use-discovery-feed";

function card(overrides: Partial<DiscoveryProfileCard> = {}): DiscoveryProfileCard {
  return {
    id: "p1",
    displayName: "Ada",
    age: 30,
    bio: "Hello",
    gender: "woman",
    whatIAmLookingFor: "relationship",
    distanceLabel: "Cerca de ti",
    distanceKmApprox: 1,
    score: 80,
    sharedTagsCount: 2,
    photoUrl: "https://example.com/a.jpg",
    photoCount: 1,
    ...overrides
  };
}

function page(profiles: DiscoveryProfileCard[], nextCursor: string | null): DiscoveryFeedPage {
  return { profiles, nextCursor };
}

describe("useDiscoveryFeed", () => {
  it("loads the first page on mount and moves to ready", async () => {
    const fetchPage = vi.fn(async () => page([card()], "cursor-2"));
    const recordAction = vi.fn();

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.profiles).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it("surfaces an error status when the first page fails", async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error("network down");
    });
    const recordAction = vi.fn();

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("network down");
    expect(result.current.profiles).toHaveLength(0);
  });

  it("appends the next page and marks the feed as exhausted when cursor is null", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([card({ id: "p1" })], "cursor-2"))
      .mockResolvedValueOnce(page([card({ id: "p2" })], null));
    const recordAction = vi.fn();

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.profiles.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(result.current.hasMore).toBe(false);
    expect(fetchPage).toHaveBeenNthCalledWith(2, "cursor-2");
  });

  it("does not duplicate profiles returned across pages", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(page([card({ id: "p1" })], "cursor-2"))
      .mockResolvedValueOnce(page([card({ id: "p1" }), card({ id: "p2" })], null));
    const recordAction = vi.fn();

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.profiles.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("optimistically removes a profile on like and keeps it removed on success", async () => {
    const fetchPage = vi.fn(async () => page([card({ id: "p1" })], null));
    const recordAction = vi.fn(async (): Promise<DiscoveryActionResponse> => ({
      matchCreated: false
    }));

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    let response: DiscoveryActionResponse | null = null;
    await act(async () => {
      response = await result.current.act({ targetProfileId: "p1", actionType: "like" });
    });

    expect(response).toEqual({ matchCreated: false });
    expect(result.current.profiles).toHaveLength(0);
    expect(recordAction).toHaveBeenCalledWith({ targetProfileId: "p1", actionType: "like" });
    expect(result.current.lastMatch).toBeNull();
  });

  it("captures the match when a like is mutual", async () => {
    const fetchPage = vi.fn(async () => page([card({ id: "p1" })], null));
    const recordAction = vi.fn(async (): Promise<DiscoveryActionResponse> => ({
      matchCreated: true,
      match: {
        id: "m1",
        matchedAt: "2026-06-17T00:00:00Z",
        expiresAt: "2026-06-24T00:00:00Z",
        otherProfile: { id: "p1", displayName: "Ada", age: 30 }
      }
    }));

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.act({ targetProfileId: "p1", actionType: "like" });
    });

    expect(result.current.lastMatch?.id).toBe("m1");
  });

  it("restores the profile and surfaces an action error when recording fails", async () => {
    const fetchPage = vi.fn(async () => page([card({ id: "p1" })], null));
    const recordAction = vi.fn(async () => {
      throw new Error("forbidden");
    });

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    let response: DiscoveryActionResponse | null = { matchCreated: false };
    await act(async () => {
      response = await result.current.act({ targetProfileId: "p1", actionType: "dislike" });
    });

    expect(response).toBeNull();
    expect(result.current.profiles.map((p) => p.id)).toEqual(["p1"]);
    expect(result.current.actionError).toBe("forbidden");
  });

  it("clears the match celebration when dismissed", async () => {
    const fetchPage = vi.fn(async () => page([card({ id: "p1" })], null));
    const recordAction = vi.fn(async (): Promise<DiscoveryActionResponse> => ({
      matchCreated: true,
      match: {
        id: "m1",
        matchedAt: "2026-06-17T00:00:00Z",
        expiresAt: "2026-06-24T00:00:00Z",
        otherProfile: { id: "p1", displayName: "Ada", age: 30 }
      }
    }));

    const { result } = renderHook(() => useDiscoveryFeed({ fetchPage, recordAction }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => {
      await result.current.act({ targetProfileId: "p1", actionType: "like" });
    });
    await act(async () => {
      result.current.dismissMatch();
    });

    expect(result.current.lastMatch).toBeNull();
  });
});
