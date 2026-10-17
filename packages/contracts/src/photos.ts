/** Foto de OTRO perfil. `url` absoluta; con R2 es una autorización temporal, no persistirla. */
export interface PhotoSummary {
  id: string;
  url: string;
  position: number;
}

/** Foto propia (`/api/me/*`). `url` absoluta. */
export interface ProfilePhoto {
  id: string;
  storageKey: string;
  url: string;
  position: number;
  isActive: boolean;
}

export interface ProfilePhotosResponse {
  photos: ProfilePhoto[];
}

export type PhotoContentType = "image/jpeg" | "image/png" | "image/webp";

/** Body de `POST /api/me/photos/upload-intent`. */
export interface PhotoUploadIntentRequest {
  position: number;
  contentType: PhotoContentType;
  sizeBytes: number;
}

/**
 * Respuesta de `POST /api/me/photos/upload-intent`.
 * Subir el binario con `method` a `uploadUrl` enviando TODOS los `headers` devueltos.
 */
export interface PhotoUploadIntent {
  storageKey: string;
  uploadUrl: string;
  /** Nombre histórico: referencia sin autorización de lectura, no es una foto pública. */
  publicUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

/** Body de `POST /api/me/photos/complete`. */
export interface PhotoUploadCompleteRequest {
  storageKey: string;
  publicUrl: string;
  position: number;
  contentType: PhotoContentType;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface PhotoUploadCompleteResponse {
  photo: ProfilePhoto;
}

/** Body de `PUT /api/me/photos/order`: IDs de fotos activas en el orden deseado. */
export interface PhotoReorderRequest {
  photoIds: string[];
}

export interface PhotoReorderResponse {
  photos: ProfilePhoto[];
}

export type PhotoUploadErrorCode =
  | "storage_not_configured"
  | "storage_unavailable"
  | "too_many_photos"
  | "photo_position_taken"
  | "upload_intent_not_found"
  | "upload_intent_completed"
  | "upload_intent_expired"
  | "upload_url_mismatch"
  | "upload_content_type_mismatch"
  | "upload_object_not_found"
  | "upload_object_changed"
  | "upload_size_mismatch"
  | "upload_invalid_image";

export const MIN_PROFILE_PHOTOS = 2;
export const MAX_PROFILE_PHOTOS = 4;

export interface PhotoReadUrlResponse {
  url: string;
  expiresAt: string;
}
