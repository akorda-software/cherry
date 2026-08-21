import type { Tag } from "./discovery";
import type { DiscoveryPreferences } from "./discovery";

export type Gender = "man" | "woman" | "non_binary";
export type RelationshipIntent = "relationship" | "casual" | "meet_people" | "go_with_the_flow";

export interface ProfilePhoto {
  id: string;
  storageKey: string;
  url: string;
  position: number;
  isActive: boolean;
}

export interface Profile {
  id: string;
  displayName: string | null;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  whatIAmLookingFor: RelationshipIntent | null;
  bio: string | null;
  isComplete: boolean;
  isPaused: boolean;
  isDiscoverable: boolean;
  photos: ProfilePhoto[];
  tags: Tag[];
  blockedTags: Tag[];
  discoveryPreferences: DiscoveryPreferences | null;
  insertedAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  profile: Profile | null;
  completeness: boolean;
}

export interface ProfileUpdateResponse {
  profile: Profile;
}

export interface ProfileCompleteResponse {
  profile: Profile;
  onboardingRequired?: boolean;
}

export interface DiscoveryPreferencesResponse {
  discoveryPreferences: DiscoveryPreferences;
}

export type OnboardingStep =
  | "name"
  | "birth_date"
  | "gender"
  | "intent"
  | "bio"
  | "photos"
  | "interested_in"
  | "discovery_preferences"
  | "tags"
  | "location";

export type ProfileField =
  | "displayName"
  | "birthDate"
  | "gender"
  | "whatIAmLookingFor"
  | "bio";
