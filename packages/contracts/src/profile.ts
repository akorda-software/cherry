import type { DiscoveryPreferences } from "./discovery";
import type { ProfilePhoto } from "./photos";
import type { Tag } from "./tags";

export type Gender = "man" | "woman" | "non_binary";
export type RelationshipIntent = "relationship" | "casual" | "meet_people" | "go_with_the_flow";

/** Perfil propio (`GET /api/me/profile`). */
export interface Profile {
  id: string;
  displayName: string | null;
  birthDate: string | null;
  age: number | null;
  gender: Gender | null;
  /** «¿Qué buscas?»: 1–4 intenciones sin repetir, en orden canónico. `[]` si está sin contestar. */
  lookingFor: RelationshipIntent[];
  /**
   * @deprecated Primera intención de `lookingFor` (o `null`), solo para versiones antiguas
   * de la app. Usa `lookingFor`.
   */
  whatIAmLookingFor: RelationshipIntent | null;
  bio: string | null;
  isComplete: boolean;
  isPaused: boolean;
  isDiscoverable: boolean;
  /** Hay ubicación guardada (nunca se devuelven coordenadas). */
  hasLocation: boolean;
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
  | "lookingFor"
  | "bio";

/** Body de `POST /api/me/location`. El backend lo redondea a una rejilla de 500 m. Respuesta: `OkResponse`. */
export interface LocationUpdateRequest {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  /** ISO 8601; si se omite, el backend usa la hora de recepción. */
  recordedAt?: string;
}
