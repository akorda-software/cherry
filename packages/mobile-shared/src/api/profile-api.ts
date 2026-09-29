import type {
  BlockedTagsResponse,
  DiscoveryPreferences,
  DiscoveryPreferencesResponse,
  Gender,
  LocationUpdateRequest,
  OkResponse,
  PhotoReorderResponse,
  PhotoUploadCompleteRequest,
  PhotoUploadCompleteResponse,
  PhotoUploadIntent,
  PhotoUploadIntentRequest,
  Profile,
  ProfileCompleteResponse,
  ProfileField,
  ProfilePhoto,
  ProfilePhotosResponse,
  ProfileResponse,
  ProfileTagsResponse,
  ProfileUpdateResponse,
  RelationshipIntent,
  Tag,
  TagCatalogResponse
} from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { httpDelete, pathSegment } from "./http-utils";

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

  /** `POST /api/me/location` con `{latitude, longitude, accuracyMeters?, recordedAt?}`. */
  updateLocation(location: LocationUpdateRequest): Promise<void>;

  /** Fotos activas propias, por posición. */
  listPhotos(): Promise<ProfilePhoto[]>;
  /** Paso 1 de la subida: pide la URL firmada. Luego `PUT uploadUrl` con TODOS los `headers`. */
  createPhotoUploadIntent(request: PhotoUploadIntentRequest): Promise<PhotoUploadIntent>;
  /** Paso 3 de la subida: el backend verifica el objeto subido y registra la foto. */
  completePhotoUpload(request: PhotoUploadCompleteRequest): Promise<ProfilePhoto>;
  deletePhoto(photoId: string): Promise<void>;
  /** Reordena las fotos activas (`photoIds` en el orden deseado) y devuelve la lista resultante. */
  reorderPhotos(photoIds: string[]): Promise<ProfilePhoto[]>;
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
  if (fields.expandDistance !== undefined) out.expand_distance = fields.expandDistance;
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
    async updateLocation(location) {
      const body: Record<string, unknown> = {
        latitude: location.latitude,
        longitude: location.longitude
      };
      if (location.accuracyMeters !== undefined) body.accuracyMeters = location.accuracyMeters;
      if (location.recordedAt !== undefined) body.recordedAt = location.recordedAt;

      await httpClient.post<OkResponse>("/api/me/location", body);
    },
    async listPhotos() {
      const response = await httpClient.get<ProfilePhotosResponse>("/api/me/photos");
      return response.photos;
    },
    async createPhotoUploadIntent(request) {
      return httpClient.post<PhotoUploadIntent>("/api/me/photos/upload-intent", {
        position: request.position,
        contentType: request.contentType,
        sizeBytes: request.sizeBytes
      });
    },
    async completePhotoUpload(request) {
      const body: Record<string, unknown> = {
        storageKey: request.storageKey,
        publicUrl: request.publicUrl,
        position: request.position,
        contentType: request.contentType,
        sizeBytes: request.sizeBytes
      };
      if (request.width !== undefined) body.width = request.width;
      if (request.height !== undefined) body.height = request.height;

      const response = await httpClient.post<PhotoUploadCompleteResponse>(
        "/api/me/photos/complete",
        body
      );
      return response.photo;
    },
    async deletePhoto(photoId) {
      await httpDelete<OkResponse>(httpClient, `/api/me/photos/${pathSegment(photoId)}`);
    },
    async reorderPhotos(photoIds) {
      const response = await httpClient.put<PhotoReorderResponse>("/api/me/photos/order", {
        photoIds
      });
      return response.photos;
    }
  };
}
