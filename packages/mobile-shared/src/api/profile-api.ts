import type {
  BlockedTagsResponse,
  DiscoveryPreferences,
  DiscoveryPreferencesResponse,
  Gender,
  Profile,
  ProfileCompleteResponse,
  ProfileField,
  ProfileResponse,
  ProfileTagsResponse,
  ProfileUpdateResponse,
  RelationshipIntent,
  Tag,
  TagCatalogResponse
} from "@snack/contracts";

import type { HttpClient } from "./auth-api";

export interface ProfileApi {
  getTagCatalog(): Promise<Tag[]>;
  getPositiveTags(): Promise<Tag[]>;
  getBlockedTags(): Promise<Tag[]>;
  setPositiveTags(tagIds: string[]): Promise<Tag[]>;
  setBlockedTags(tagIds: string[]): Promise<Tag[]>;

  getProfile(): Promise<ProfileResponse>;
  updateProfile(fields: ProfileUpdateFields): Promise<ProfileUpdateResponse>;
  completeProfile(): Promise<ProfileCompleteResponse>;

  getDiscoveryPreferences(): Promise<DiscoveryPreferencesResponse>;
  updateDiscoveryPreferences(fields: Partial<DiscoveryPreferences>): Promise<DiscoveryPreferencesResponse>;

  updateLocation(fields: {
    lat: number;
    lng: number;
    city?: string;
    region?: string;
    country?: string;
  }): Promise<{ location: unknown }>;
}

export type ProfileUpdateFields = Partial<
  Pick<Profile, ProfileField> & {
    gender: Gender | null;
    whatIAmLookingFor: RelationshipIntent | null;
  }
>;

const FIELD_TO_SNAKE: Record<ProfileField, string> = {
  displayName: "display_name",
  birthDate: "birth_date",
  gender: "gender",
  whatIAmLookingFor: "what_i_am_looking_for",
  bio: "bio"
};

function toSnakeProfile(fields: ProfileUpdateFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (Object.keys(fields) as ProfileField[]).forEach((key) => {
    if (fields[key] !== undefined) {
      out[FIELD_TO_SNAKE[key]] = fields[key];
    }
  });
  return out;
}

function toSnakeDiscovery(
  fields: Partial<DiscoveryPreferences>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (fields.ageMin !== undefined) out.age_min = fields.ageMin;
  if (fields.ageMax !== undefined) out.age_max = fields.ageMax;
  if (fields.distanceKm !== undefined) out.distance_km = fields.distanceKm;
  if (fields.showMen !== undefined) out.show_men = fields.showMen;
  if (fields.showWomen !== undefined) out.show_women = fields.showWomen;
  if (fields.showNonBinary !== undefined) out.show_non_binary = fields.showNonBinary;
  if (fields.compatibleOnly !== undefined) out.compatible_only = fields.compatibleOnly;
  if (fields.discoveryMode !== undefined) out.discovery_mode = fields.discoveryMode;
  return out;
}

export function createProfileApi(httpClient: HttpClient): ProfileApi {
  return {
    async getTagCatalog() {
      const response = await httpClient.get<TagCatalogResponse>("/api/tags");
      return response.tags;
    },
    async getPositiveTags() {
      const response = await httpClient.get<ProfileTagsResponse>("/api/me/tags");
      return response.tags;
    },
    async getBlockedTags() {
      const response = await httpClient.get<BlockedTagsResponse>("/api/me/blocked-tags");
      return response.blockedTags;
    },
    async setPositiveTags(tagIds) {
      const response = await httpClient.put<ProfileTagsResponse>("/api/me/tags", {
        tag_ids: tagIds
      });
      return response.tags;
    },
    async setBlockedTags(tagIds) {
      const response = await httpClient.put<BlockedTagsResponse>("/api/me/blocked-tags", {
        tag_ids: tagIds
      });
      return response.blockedTags;
    },
    async getProfile() {
      return httpClient.get<ProfileResponse>("/api/me/profile");
    },
    async updateProfile(fields) {
      return httpClient.put<ProfileUpdateResponse>("/api/me/profile", toSnakeProfile(fields));
    },
    async completeProfile() {
      return httpClient.post<ProfileCompleteResponse>("/api/me/profile/complete", {});
    },
    async getDiscoveryPreferences() {
      return httpClient.get<DiscoveryPreferencesResponse>("/api/me/discovery-preferences");
    },
    async updateDiscoveryPreferences(fields) {
      return httpClient.put<DiscoveryPreferencesResponse>(
        "/api/me/discovery-preferences",
        toSnakeDiscovery(fields)
      );
    },
    async updateLocation(fields) {
      return httpClient.post<{ location: unknown }>("/api/me/location", {
        lat: fields.lat,
        lng: fields.lng,
        city: fields.city,
        region: fields.region,
        country: fields.country
      });
    }
  };
}
