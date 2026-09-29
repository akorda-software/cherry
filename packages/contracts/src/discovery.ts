import type { MatchProfileSummary } from "./matches";
import type { PhotoSummary } from "./photos";
import type { OnboardingStep } from "./profile";
import type { ProfileTag } from "./tags";

export type DiscoveryMode = "swipe" | "feed";

export type DiscoveryActionType = "like" | "dislike";

export interface DiscoveryPreferences {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  showMen: boolean;
  showWomen: boolean;
  showNonBinary: boolean;
  compatibleOnly: boolean;
  /** Si el radio preferido se queda corto, añade un segundo tramo (hasta min(2×radio, radio+100 km)) siempre detrás. */
  expandDistance: boolean;
  discoveryMode: DiscoveryMode;
}

/**
 * Card de perfil. La emiten el feed (`GET /api/discovery/feed`), los likes recibidos
 * (`GET /api/likes/received`) y el deshacer (`POST /api/discovery/undo`).
 */
export interface DiscoveryProfileCard {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string;
  whatIAmLookingFor: string;
  /** Etiqueta aproximada generada por backend ("Cerca de ti", "A unos 15 km", "A más de 100 km"). `null` si falta alguna ubicación (solo fuera del feed). */
  distanceLabel: string | null;
  distanceKmApprox: number | null;
  /**
   * @deprecated El backend ya no lo envía: la puntuación de ranking delataba señales
   * privadas (actividad, likes pendientes). Se eliminará del contrato.
   */
  score?: number;
  sharedTagsCount: number;
  /** Foto principal (absoluta). Equivale a `photos[0]?.url`. */
  photoUrl: string | null;
  photoCount: number;
  /** Fotos activas ordenadas por posición (URLs absolutas). */
  photos: PhotoSummary[];
  /** Etiquetas positivas: compartidas primero, luego categoría/sortOrder. */
  tags: ProfileTag[];
  /** Esta persona ya te ha dado like: si le das like, es match al instante. */
  likedYou: boolean;
  /** Perfil recién llegado (boost de novedad). */
  isNewcomer: boolean;
  /** Fuera de tu distancia preferida (el feed amplió el radio por poca oferta). */
  beyondPreferredDistance: boolean;
}

export interface DiscoveryFeedPage {
  profiles: DiscoveryProfileCard[];
  nextCursor: string | null;
}

export interface DiscoveryFeedQuery {
  limit?: number;
  cursor?: string | null;
}

/** Resumen del otro perfil en la respuesta de match (id, nombre, edad y foto principal). */
export type DiscoveryMatchProfile = MatchProfileSummary;

export interface DiscoveryMatch {
  id: string;
  /** Conversación ya creada: el móvil puede abrir el chat directamente. */
  conversationId: string;
  matchedAt: string;
  /** Caducidad a 30 días si nadie escribe; `null` si ya no caduca. */
  expiresAt: string | null;
  otherProfile: DiscoveryMatchProfile;
}

export type DiscoveryActionResponse =
  | { matchCreated: false }
  | { matchCreated: true; match: DiscoveryMatch };

export interface DiscoveryActionRequest {
  targetProfileId: string;
  actionType: DiscoveryActionType;
}

/** `POST /api/discovery/undo`: deshace el último "no" (< 10 min) y devuelve su card. */
/**
 * `POST /api/discovery/undo`. El «no» se deshace siempre que fuera el último swipe y
 * tenga < 10 min; `profile` es `null` si esa persona ya no es visible (pausa,
 * bloqueo, filtros...): no hay card que reinsertar.
 */
export interface DiscoveryUndoResponse {
  undone: true;
  profile: DiscoveryProfileCard | null;
}

/**
 * 403 del feed. `profile_incomplete` → llevar a onboarding (`nextOnboardingStep` puede ser
 * `null` si solo falta confirmar con `POST /api/me/profile/complete`); `profile_paused` → mostrar
 * el estado de perfil en pausa (no es onboarding).
 */
export type DiscoveryFeedForbiddenResponse =
  | {
      error: "profile_incomplete";
      reason: string;
      onboardingRequired: true;
      nextOnboardingStep: OnboardingStep | null;
    }
  | {
      error: "profile_paused";
      reason: string;
      onboardingRequired: false;
      nextOnboardingStep: null;
    };

/**
 * Errores de discovery:
 * - 403 `profile_incomplete` | `profile_paused` (feed; ver `DiscoveryFeedForbiddenResponse`)
 * - 404 `profile_not_found` (sin perfil propio, o destino inexistente/no visible)
 * - 409 `already_swiped`
 * - 422 `cannot_swipe_self` | `invalid_action_type` | `invalid_params` | `nothing_to_undo` |
 *   `invalid_cursor` | `invalid_limit`
 */
export type DiscoveryErrorCode =
  | "profile_incomplete"
  | "profile_paused"
  | "profile_not_found"
  | "already_swiped"
  | "cannot_swipe_self"
  | "invalid_action_type"
  | "invalid_params"
  | "nothing_to_undo"
  | "invalid_cursor"
  | "invalid_limit";

/** Ventana en la que se puede deshacer el último "no". */
export const DISCOVERY_UNDO_WINDOW_MINUTES = 10;

export function createDiscoveryProfileCard(card: DiscoveryProfileCard): DiscoveryProfileCard {
  // `?? []` tolerates payloads from backends older than contracts v2.
  return {
    ...card,
    photos: (card.photos ?? []).map((photo) => ({ ...photo })),
    tags: (card.tags ?? []).map((tag) => ({ ...tag }))
  };
}

export function createDiscoveryFeedPage(page: DiscoveryFeedPage): DiscoveryFeedPage {
  return {
    profiles: page.profiles.map(createDiscoveryProfileCard),
    nextCursor: page.nextCursor
  };
}
