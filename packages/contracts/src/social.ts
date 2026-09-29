import type { CursorPageQuery } from "./common";
import type { DiscoveryProfileCard } from "./discovery";
import type { PhotoSummary } from "./photos";
import type { ProfileTag } from "./tags";

/**
 * Perfil público de otra persona (`GET /api/profiles/:id` → `PublicProfileResponse`).
 * Visible si no hay bloqueo en ninguna dirección, ninguna cuenta está borrada y el perfil es
 * descubrible, o hay match activo, o esa persona te dio like. Si no → 404 `profile_not_found`.
 * Nunca incluye coordenadas.
 */
export interface PublicProfile {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string;
  whatIAmLookingFor: string;
  distanceLabel: string | null;
  distanceKmApprox: number | null;
  photos: PhotoSummary[];
  tags: ProfileTag[];
  /** Esta persona te ha dado like (si aún no le has respondido, tu like = match al instante). */
  likedYou: boolean;
  /** Tú le diste like. */
  youLiked: boolean;
  /** Match activo entre ambos (si existe). */
  matchId: string | null;
  conversationId: string | null;
  isNewcomer: boolean;
}

export interface PublicProfileResponse {
  profile: PublicProfile;
}

/** Like recibido al que aún no has respondido. Dale like con `POST /api/discovery/actions` → match al instante. */
export interface ReceivedLike {
  likedAt: string;
  profile: DiscoveryProfileCard;
}

/**
 * `GET /api/likes/received?cursor&limit` (limit 1..50, por defecto 30). Like más reciente primero.
 * Excluye: personas a las que ya respondiste, bloqueos, cuentas borradas, perfiles pausados,
 * etiquetas bloqueadas (ambas direcciones) y perfiles fuera de tu género/edad/intención.
 */
export interface ReceivedLikesPage {
  likes: ReceivedLike[];
  nextCursor: string | null;
}

export type ReceivedLikesQuery = CursorPageQuery;

/** `GET /api/me/summary`: contadores para los badges de las pestañas. */
export interface ActivitySummary {
  /** Likes recibidos pendientes (misma regla que `GET /api/likes/received`). */
  receivedLikesCount: number;
  /** Matches activos sin mensajes que aún no has abierto (`POST /api/conversations/:id/read` los marca vistos). */
  newMatchesCount: number;
  /** Conversaciones activas con mensajes del otro sin leer. */
  unreadConversationsCount: number;
}

export const RECEIVED_LIKES_DEFAULT_LIMIT = 30;
export const RECEIVED_LIKES_MAX_LIMIT = 50;

export function totalActivityBadgeCount(summary: ActivitySummary): number {
  return summary.receivedLikesCount + summary.newMatchesCount + summary.unreadConversationsCount;
}
