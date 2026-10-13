import { friendlyErrorMessage } from "../../../shared/api";

/**
 * Errores de la subida de fotos con mensaje amable. `code` es el `error` del
 * backend (`storage_not_configured`, `upload_invalid_image`…) o uno local.
 */
export type PhotoErrorCode =
  | "storage_not_configured"
  | "storage_unavailable"
  | "too_many_photos"
  | "photo_position_taken"
  | "upload_expired"
  | "invalid_image"
  | "upload_mismatch"
  | "too_large"
  | "processing_failed"
  | "rate_limited"
  | "network"
  | "unknown";

export class PhotoUploadError extends Error {
  readonly code: PhotoErrorCode;
  readonly status?: number;

  constructor(code: PhotoErrorCode, options: { status?: number; message?: string; cause?: unknown } = {}) {
    super(options.message ?? code);
    this.name = "PhotoUploadError";
    this.code = code;
    this.status = options.status;
    (this as { cause?: unknown }).cause = options.cause;
  }
}

const BACKEND_CODE_TO_PHOTO_CODE: Record<string, PhotoErrorCode> = {
  storage_not_configured: "storage_not_configured",
  storage_unavailable: "storage_unavailable",
  too_many_photos: "too_many_photos",
  photo_position_taken: "photo_position_taken",
  upload_intent_expired: "upload_expired",
  upload_token_expired: "upload_expired",
  upload_invalid_image: "invalid_image",
  upload_content_type_mismatch: "invalid_image",
  upload_too_large: "too_large",
  upload_intent_not_found: "upload_mismatch",
  upload_intent_completed: "upload_mismatch",
  upload_url_mismatch: "upload_mismatch",
  upload_object_not_found: "upload_mismatch",
  upload_object_changed: "upload_mismatch",
  upload_size_mismatch: "upload_mismatch",
  upload_already_exists: "upload_mismatch",
  upload_token_invalid: "upload_mismatch",
  too_many_upload_intents: "rate_limited",
  upload_rate_limited: "rate_limited"
};

export function photoErrorCodeFromBackend(code: string | null | undefined): PhotoErrorCode | null {
  return code ? BACKEND_CODE_TO_PHOTO_CODE[code] ?? null : null;
}

/** ¿Es el 422 de validación del intent por tamaño (`errors.size_bytes`)? */
export function isSizeValidationError(error: unknown): boolean {
  const candidate = error as { status?: unknown; body?: unknown } | null;
  const errors = (candidate?.body as { errors?: Record<string, unknown> } | null | undefined)?.errors;
  return candidate?.status === 422 && !!errors && typeof errors === "object" && "size_bytes" in errors;
}

/** Normaliza cualquier error de la subida a `PhotoUploadError`. */
export function toPhotoUploadError(error: unknown): PhotoUploadError {
  if (error instanceof PhotoUploadError) {
    return error;
  }

  const candidate = error as { status?: unknown; code?: unknown } | null;
  const status = typeof candidate?.status === "number" ? candidate.status : undefined;
  const mapped = photoErrorCodeFromBackend(typeof candidate?.code === "string" ? candidate.code : null);

  if (mapped) {
    return new PhotoUploadError(mapped, { status, cause: error });
  }

  if (error instanceof TypeError || status === 0) {
    return new PhotoUploadError("network", { status, cause: error });
  }

  if (status === 413) {
    return new PhotoUploadError("too_large", { status, cause: error });
  }

  return new PhotoUploadError("unknown", { status, cause: error });
}

export function photoErrorMessage(error: unknown): string {
  const photoError = toPhotoUploadError(error);

  switch (photoError.code) {
    case "storage_not_configured":
      return "Este servidor de Cherry aún no puede guardar fotos. Quien lo administra tiene que activar el almacenamiento; lo que llevas ya está guardado.";
    case "storage_unavailable":
      return "El almacén de fotos no responde ahora mismo. Dale un momento y vuelve a intentarlo.";
    case "too_many_photos":
      return "Ya tienes 4 fotos. Quita una para añadir otra.";
    case "photo_position_taken":
      return "Ese hueco se acaba de ocupar. Vuelve a intentarlo.";
    case "upload_expired":
      return "La subida ha tardado demasiado. Vuelve a intentarlo.";
    case "invalid_image":
      return "Esa imagen no se puede usar. Prueba con otra foto (JPG, PNG o WebP).";
    case "upload_mismatch":
      return "La foto no ha llegado entera. Vuelve a intentarlo.";
    case "too_large":
      return "Esta foto pesa demasiado incluso comprimida. Prueba con otra.";
    case "processing_failed":
      return "No hemos podido preparar esta foto. Prueba con otra.";
    case "rate_limited":
      return "Has intentado subir muchas fotos seguidas. Espera un poquito y vuelve a probar.";
    case "network":
      return friendlyErrorMessage(Object.assign(new Error("network"), { status: 0 }));
    case "unknown":
      return friendlyErrorMessage(photoError.cause ?? photoError, "No hemos podido subir la foto. Vuelve a intentarlo.");
  }
}

/** Errores que no se arreglan reintentando la misma foto. */
export function isRetryablePhotoError(error: unknown): boolean {
  const code = toPhotoUploadError(error).code;
  return !["storage_not_configured", "too_many_photos", "invalid_image", "too_large", "processing_failed"].includes(code);
}
