import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscoveryMatch, Profile } from "@cherry/contracts";

import { useOwnPhotoStore } from "./application/own-photo-store";
import { useMatchCelebrationStore } from "./match-celebration-store";

function match(id: string): DiscoveryMatch {
  return {
    id,
    conversationId: `c-${id}`,
    matchedAt: "2026-09-29T10:00:00Z",
    expiresAt: null,
    otherProfile: { id: `p-${id}`, displayName: "Lucía", age: 29, photoUrl: null }
  };
}

describe("match celebration store", () => {
  beforeEach(() => {
    useMatchCelebrationStore.setState({ match: null, queue: [] });
  });

  it("shows a match and dismisses it", () => {
    useMatchCelebrationStore.getState().show(match("1"));
    expect(useMatchCelebrationStore.getState().match?.id).toBe("1");

    useMatchCelebrationStore.getState().dismiss();
    expect(useMatchCelebrationStore.getState().match).toBeNull();
  });

  it("queues back-to-back matches and ignores duplicates", () => {
    const { show, dismiss } = useMatchCelebrationStore.getState();
    show(match("1"));
    show(match("2"));
    show(match("2"));
    show(match("1"));

    expect(useMatchCelebrationStore.getState().queue.map((m) => m.id)).toEqual(["2"]);

    dismiss();
    expect(useMatchCelebrationStore.getState().match?.id).toBe("2");
    dismiss();
    expect(useMatchCelebrationStore.getState().match).toBeNull();
  });
});

describe("own photo store", () => {
  it("keeps the first active photo by position", async () => {
    const load = vi.fn(async () => ({
      displayName: "Lucía",
      photos: [
        { id: "b", storageKey: "b", url: "https://x/b.jpg", position: 2, isActive: true },
        { id: "a", storageKey: "a", url: "https://x/a.jpg", position: 1, isActive: true }
      ]
    }) as unknown as Profile);

    await useOwnPhotoStore.getState().refresh("u1", load);

    expect(useOwnPhotoStore.getState().url).toBe("https://x/a.jpg");
    expect(useOwnPhotoStore.getState().status).toBe("ready");
  });

  it("forgets the photo on sign-out", async () => {
    await useOwnPhotoStore.getState().refresh(null, vi.fn());

    expect(useOwnPhotoStore.getState().url).toBeNull();
  });
});
