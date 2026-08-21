export type DiscoveryMode = "swipe" | "feed";

export type DiscoveryActionType = "like" | "dislike";

export interface Tag {
  id: string;
  slug: string;
  label: string;
  category: string;
  sortOrder?: number;
}

export interface TagCatalogResponse {
  tags: Tag[];
}

export interface ProfileTagsResponse {
  tags: Tag[];
}

export interface BlockedTagsResponse {
  blockedTags: Tag[];
}

export interface DiscoveryPreferences {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  showMen: boolean;
  showWomen: boolean;
  showNonBinary: boolean;
  compatibleOnly: boolean;
  discoveryMode: DiscoveryMode;
}

export interface DiscoveryProfileCard {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string;
  whatIAmLookingFor: string;
  distanceLabel: string;
  distanceKmApprox: number;
  score: number;
  sharedTagsCount: number;
  photoUrl: string | null;
  photoCount: number;
}

export interface DiscoveryFeedPage {
  profiles: DiscoveryProfileCard[];
  nextCursor: string | null;
}

export interface DiscoveryFeedQuery {
  limit?: number;
  cursor?: string | null;
}

export interface DiscoveryMatchProfile {
  id: string;
  displayName: string | null;
  age: number | null;
}

export interface DiscoveryMatch {
  id: string;
  matchedAt: string;
  expiresAt: string;
  otherProfile: DiscoveryMatchProfile;
}

export type DiscoveryActionResponse =
  | { matchCreated: false }
  | { matchCreated: true; match: DiscoveryMatch };

export interface DiscoveryActionRequest {
  targetProfileId: string;
  actionType: DiscoveryActionType;
}

export function createDiscoveryProfileCard(card: DiscoveryProfileCard): DiscoveryProfileCard {
  return { ...card };
}

export function createDiscoveryFeedPage(page: DiscoveryFeedPage): DiscoveryFeedPage {
  return {
    profiles: page.profiles.map(createDiscoveryProfileCard),
    nextCursor: page.nextCursor
  };
}
