import { describe, expect, it } from "vitest";

import {
  type DiscoveryActionResponse,
  type DiscoveryFeedPage,
  type DiscoveryProfileCard,
  createDiscoveryFeedPage,
  createDiscoveryProfileCard
} from "./discovery";

const card: DiscoveryProfileCard = {
  id: "profile-1",
  displayName: "Ada",
  age: 30,
  bio: "Hello world",
  gender: "woman",
  whatIAmLookingFor: "relationship",
  distanceLabel: "Cerca de ti",
  distanceKmApprox: 2,
  score: 88,
  sharedTagsCount: 3,
  photoUrl: "https://example.com/photo1.jpg",
  photoCount: 2
};

describe("createDiscoveryProfileCard", () => {
  it("copies the card without mutating the source", () => {
    const copy = createDiscoveryProfileCard(card);

    expect(copy).toEqual(card);
    expect(copy).not.toBe(card);
  });

  it("keeps null photo urls for profiles without a photo", () => {
    const copy = createDiscoveryProfileCard({ ...card, photoUrl: null });

    expect(copy.photoUrl).toBeNull();
    expect(copy.photoCount).toBe(2);
  });
});

describe("createDiscoveryFeedPage", () => {
  it("maps cards and preserves the next cursor", () => {
    const page: DiscoveryFeedPage = createDiscoveryFeedPage({
      profiles: [card, { ...card, id: "profile-2" }],
      nextCursor: "2026-06-17T00:00:00Z"
    });

    expect(page.profiles).toHaveLength(2);
    expect(page.profiles[1]?.id).toBe("profile-2");
    expect(page.nextCursor).toBe("2026-06-17T00:00:00Z");
  });

  it("represents the end of the feed with a null cursor", () => {
    const page: DiscoveryFeedPage = createDiscoveryFeedPage({
      profiles: [],
      nextCursor: null
    });

    expect(page.profiles).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });
});

describe("DiscoveryActionResponse", () => {
  it("distinguishes a plain like from a created match", () => {
    const noMatch: DiscoveryActionResponse = { matchCreated: false };
    const match: DiscoveryActionResponse = {
      matchCreated: true,
      match: {
        id: "match-1",
        matchedAt: "2026-06-17T00:00:00Z",
        expiresAt: "2026-06-24T00:00:00Z",
        otherProfile: { id: "profile-2", displayName: "Ada", age: 30 }
      }
    };

    expect(noMatch.matchCreated).toBe(false);
    expect(match.matchCreated).toBe(true);
  });
});
