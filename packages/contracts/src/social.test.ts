import { describe, expect, it } from "vitest";

import type { DiscoveryProfileCard } from "./discovery";
import type { ChatMessage, MatchSummary } from "./matches";
import { MATCH_EXPIRY_DAYS, MAX_MESSAGE_LENGTH } from "./matches";
import { REPORT_REASONS, type ReportRequest, isReportReason } from "./safety";
import {
  type ActivitySummary,
  type PublicProfile,
  RECEIVED_LIKES_DEFAULT_LIMIT,
  RECEIVED_LIKES_MAX_LIMIT,
  type ReceivedLikesPage,
  totalActivityBadgeCount
} from "./social";
import { TAG_CATEGORIES, type Tag, isTagCategory } from "./tags";

const card: DiscoveryProfileCard = {
  id: "profile-2",
  displayName: "Lucía",
  age: 29,
  bio: "Me encanta el monte y el vermú del domingo",
  gender: "woman",
  whatIAmLookingFor: "relationship",
  distanceLabel: "A unos 5 km",
  distanceKmApprox: 5,
  sharedTagsCount: 1,
  photoUrl: "https://cdn.example.com/p2-1.jpg",
  photoCount: 1,
  photos: [{ id: "photo-1", url: "https://cdn.example.com/p2-1.jpg", position: 1 }],
  tags: [
    {
      id: "tag-1",
      slug: "hiking",
      label: "Senderismo",
      category: "active",
      sortOrder: 1,
      emoji: "🥾",
      shared: true
    }
  ],
  likedYou: true,
  isNewcomer: false,
  beyondPreferredDistance: false
};

const message: ChatMessage = {
  id: "message-1",
  conversationId: "conversation-1",
  senderProfileId: "profile-2",
  body: "¡Hola!",
  insertedAt: "2026-09-29T10:00:00Z"
};

describe("tags", () => {
  it("exposes the closed list of catalog categories", () => {
    expect(TAG_CATEGORIES).toEqual([
      "interests",
      "active",
      "lifestyle",
      "values",
      "personality",
      "pets",
      "relationship"
    ]);
  });

  it("recognises known categories and rejects unknown values", () => {
    expect(isTagCategory("pets")).toBe(true);
    expect(isTagCategory("unknown")).toBe(false);
    expect(isTagCategory(42)).toBe(false);
  });

  it("allows tags without emoji", () => {
    const tag: Tag = { id: "t1", slug: "music", label: "Música", category: "interests", emoji: null };

    expect(tag.emoji).toBeNull();
  });
});

describe("safety", () => {
  it("lists every report reason accepted by the backend", () => {
    expect(REPORT_REASONS).toEqual([
      "fake_profile",
      "inappropriate_photos",
      "harassment",
      "spam",
      "underage",
      "offensive_bio",
      "other"
    ]);
  });

  it("guards report reasons", () => {
    const request: ReportRequest = { reason: "harassment", details: "Mensajes insistentes" };

    expect(isReportReason(request.reason)).toBe(true);
    expect(isReportReason("rude")).toBe(false);
    expect(isReportReason(undefined)).toBe(false);
  });
});

describe("social", () => {
  it("models a received likes page with an opaque cursor", () => {
    const page: ReceivedLikesPage = {
      likes: [{ likedAt: "2026-09-29T09:00:00Z", profile: card }],
      nextCursor: null
    };

    expect(page.likes[0]?.profile.likedYou).toBe(true);
    expect(RECEIVED_LIKES_DEFAULT_LIMIT).toBe(30);
    expect(RECEIVED_LIKES_MAX_LIMIT).toBe(50);
  });

  it("models a public profile without coordinates", () => {
    const profile: PublicProfile = {
      id: "profile-2",
      displayName: "Lucía",
      age: 29,
      bio: null,
      gender: "woman",
      whatIAmLookingFor: "relationship",
      distanceLabel: null,
      distanceKmApprox: null,
      photos: card.photos,
      tags: card.tags,
      likedYou: true,
      youLiked: false,
      matchId: null,
      conversationId: null,
      isNewcomer: false
    };

    expect(Object.keys(profile)).not.toContain("latitude");
    expect(profile.matchId).toBeNull();
  });

  it("adds up the activity badges", () => {
    const summary: ActivitySummary = {
      receivedLikesCount: 3,
      newMatchesCount: 1,
      unreadConversationsCount: 2
    };

    expect(totalActivityBadgeCount(summary)).toBe(6);
  });
});

describe("matches", () => {
  it("models a match with last message and unread count", () => {
    const match: MatchSummary = {
      id: "match-1",
      conversationId: "conversation-1",
      matchedAt: "2026-09-28T10:00:00Z",
      expiresAt: null,
      firstMessageAt: "2026-09-29T10:00:00Z",
      otherProfile: { id: "profile-2", displayName: "Lucía", age: 29, photoUrl: null },
      lastMessage: message,
      unreadCount: 1
    };

    expect(match.lastMessage?.body).toBe("¡Hola!");
    expect(match.unreadCount).toBe(1);
  });

  it("exposes chat limits and the 30-day match expiry", () => {
    expect(MAX_MESSAGE_LENGTH).toBe(2000);
    expect(MATCH_EXPIRY_DAYS).toBe(30);
  });
});
