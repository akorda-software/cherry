import { describe, expect, it } from "vitest";

import {
  DISCOVERY_UNDO_WINDOW_MINUTES,
  type DiscoveryActionResponse,
  type DiscoveryFeedPage,
  type DiscoveryProfileCard,
  type DiscoveryUndoResponse,
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
  photoCount: 2,
  photos: [
    { id: "photo-1", url: "https://example.com/photo1.jpg", position: 1 },
    { id: "photo-2", url: "https://example.com/photo2.jpg", position: 2 }
  ],
  tags: [
    {
      id: "tag-1",
      slug: "hiking",
      label: "Senderismo",
      category: "active",
      sortOrder: 1,
      emoji: "🥾",
      shared: true
    },
    {
      id: "tag-2",
      slug: "cats",
      label: "Gatos",
      category: "pets",
      sortOrder: 2,
      emoji: null,
      shared: false
    }
  ],
  likedYou: false,
  isNewcomer: true,
  beyondPreferredDistance: false
};

describe("createDiscoveryProfileCard", () => {
  it("copies the card without mutating the source", () => {
    const copy = createDiscoveryProfileCard(card);

    expect(copy).toEqual(card);
    expect(copy).not.toBe(card);
  });

  it("deep-copies photos and tags so callers can mutate them safely", () => {
    const copy = createDiscoveryProfileCard(card);

    expect(copy.photos).toEqual(card.photos);
    expect(copy.photos).not.toBe(card.photos);
    expect(copy.photos[0]).not.toBe(card.photos[0]);
    expect(copy.tags[0]).not.toBe(card.tags[0]);
    expect(copy.tags.filter((tag) => tag.shared)).toHaveLength(1);
  });

  it("allows cards without distance outside the feed", () => {
    const copy = createDiscoveryProfileCard({ ...card, distanceLabel: null, distanceKmApprox: null });

    expect(copy.distanceLabel).toBeNull();
    expect(copy.distanceKmApprox).toBeNull();
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
        conversationId: "conversation-1",
        matchedAt: "2026-06-17T00:00:00Z",
        expiresAt: "2026-07-17T00:00:00Z",
        otherProfile: {
          id: "profile-2",
          displayName: "Ada",
          age: 30,
          photoUrl: "https://example.com/photo1.jpg"
        }
      }
    };

    expect(noMatch.matchCreated).toBe(false);
    expect(match.matchCreated).toBe(true);

    if (match.matchCreated) {
      expect(match.match.conversationId).toBe("conversation-1");
      expect(match.match.otherProfile.photoUrl).toContain("https://");
    }
  });
});

describe("DiscoveryUndoResponse", () => {
  it("returns the restored card", () => {
    const response: DiscoveryUndoResponse = { undone: true, profile: card };

    expect(response.undone).toBe(true);
    expect(response.profile.id).toBe("profile-1");
    expect(DISCOVERY_UNDO_WINDOW_MINUTES).toBe(10);
  });
});
