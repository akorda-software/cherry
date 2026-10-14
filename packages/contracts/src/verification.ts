/**
 * Verificación de edad (D-2026-10-09, `docs/compliance/02-mayoria-de-edad.md`).
 *
 * `GET /api/me/verification`, `POST /api/me/verification/nfc` y el proveedor externo (Didit, selfie +
 * documento): `POST /api/me/verification/provider` y `POST /api/me/verification/provider/check`. Con
 * cualquier método el servidor solo guarda «mayor de edad: sí», el método, la fecha y una huella con
 * clave del documento (la misma para un mismo documento: un documento, una cuenta).
 */

export const AGE_VERIFICATION_METHODS = ["nfc_dni", "nfc_passport", "provider", "eu_wallet"] as const;

/** `nfc_dni` cubre las tarjetas de identidad (DNI y TIE con NIE). */
export type AgeVerificationMethod = (typeof AGE_VERIFICATION_METHODS)[number];

export type AgeVerificationStatus = "unverified" | "verified" | "revoked";

export interface AgeVerification {
  status: AgeVerificationStatus;
  method: AgeVerificationMethod | null;
  verifiedAt: string | null;
}

export interface AgeVerificationResponse {
  verification: AgeVerification;
  /** Si la instancia exige verificarse (`AGE_VERIFICATION_REQUIRED`, desactivado por defecto). */
  required: boolean;
  /** Si hay verificación con selfie + documento (Didit) configurada. Solo en `GET /api/me/verification`. */
  providerAvailable?: boolean;
}

/** `ageVerification` de `GET /api/bootstrap`. */
export interface AgeVerificationState {
  required: boolean;
  status: AgeVerificationStatus;
  /** Si hay verificación con selfie + documento (Didit) configurada. */
  providerAvailable: boolean;
}

/**
 * `GET /api/me/verification/nfc/countries`: países cuyos documentos con chip puede comprobar el
 * servidor por NFC (los de sus certificados CSCA). Códigos ISO 3166-1 alfa-2 en mayúsculas,
 * ordenados; también `EU` y `UN` (salvoconductos) y `KS` (Kosovo).
 */
export interface NfcCountriesResponse {
  countries: string[];
}

/** Body de `POST /api/me/verification/provider`. */
export interface ProviderSessionRequest {
  /** Adónde vuelve el navegador al acabar: esquema propio (`cherry://…`) o `https://`. Máx. 200. */
  callback?: string;
}

/** 201 de `POST /api/me/verification/provider`: la app abre `url` en el navegador. */
export interface ProviderSessionResponse {
  sessionId: string;
  url: string;
}

/** Body de `POST /api/me/verification/provider/check`. */
export interface ProviderCheckRequest {
  sessionId: string;
}

/**
 * 200 de `POST /api/me/verification/provider/check`:
 * - `verified`: verificado (como la respuesta de NFC).
 * - `pending`: el usuario aún no ha terminado en Didit.
 * - `in_review`: Didit lo revisa a mano; preguntar más tarde.
 */
export type ProviderCheckResponse =
  | ({ result: "verified" } & AgeVerificationResponse)
  | { result: "pending" }
  | { result: "in_review" };

/** Body de `POST /api/me/verification/nfc`: los ficheros del chip tal cual, en base64. */
export interface NfcVerificationRequest {
  /** DG1 (MRZ). Máx. 1 KB decodificado. */
  dg1: string;
  /** DG2 (foto del documento). Máx. 256 KB decodificado. */
  dg2: string;
  /** EF.SOD (firma del Estado). Máx. 32 KB decodificado. */
  sod: string;
}

/** `reason` de `document_not_verified`: por qué no se pudo probar que el documento es auténtico. */
export const DOCUMENT_NOT_VERIFIED_REASONS = [
  "malformed_sod",
  "unsupported_algorithm",
  "missing_document_signer",
  "invalid_signature",
  "untrusted_certificate",
  "certificate_expired",
  "data_group_mismatch",
  "malformed_dg1",
  "invalid_check_digit",
  "unsupported_document"
] as const;

export type DocumentNotVerifiedReason = (typeof DOCUMENT_NOT_VERIFIED_REASONS)[number];

/**
 * Errores de verificación (`error` del cuerpo):
 * - 422 `invalid_payload` | `underage` (+ `accountDeleted`: la cuenta se ha borrado entera) |
 *   `document_expired` | `document_not_verified` (+ `reason`)
 * - 422 (solo proveedor) `verification_declined` (Didit lo rechazó) | `session_expired` (caducada o
 *   abandonada: empezar otra) | `unsupported_document` (no es DNI/TIE/tarjeta de identidad ni pasaporte)
 * - 409 `document_already_used` (otra cuenta) | `already_verified` (con otro documento)
 * - 403 `verification_revoked`
 * - 404 `session_not_found` (proveedor: sesión desconocida, borrada o de otro usuario)
 * - 429 `too_many_attempts` (+ `retryAfter` en segundos y cabecera `Retry-After`)
 * - 503 `age_verification_unavailable` (la instancia no tiene clave de huella o no tiene Didit)
 * - 502 `provider_error` (Didit ha fallado o no responde)
 * - 500 `verification_error`
 *
 * Con la verificación obligatoria, la API social responde 403 `age_verification_required` y el perfil
 * queda «pendiente de verificar» (invisible) hasta comprobar la edad; `GET /api/bootstrap` lo indica en
 * `ageVerification`.
 */
export type AgeVerificationErrorCode =
  | "invalid_payload"
  | "underage"
  | "document_expired"
  | "document_not_verified"
  | "document_already_used"
  | "already_verified"
  | "verification_revoked"
  | "too_many_attempts"
  | "age_verification_unavailable"
  | "verification_error"
  | "age_verification_required"
  | "verification_declined"
  | "session_expired"
  | "unsupported_document"
  | "session_not_found"
  | "provider_error";

/** Si `response` es un verificado del proveedor (`result: "verified"`). */
export function isProviderVerified(
  response: ProviderCheckResponse
): response is Extract<ProviderCheckResponse, { result: "verified" }> {
  return response.result === "verified" && response.verification.status === "verified";
}

export function isDocumentNotVerifiedReason(value: unknown): value is DocumentNotVerifiedReason {
  return typeof value === "string" && (DOCUMENT_NOT_VERIFIED_REASONS as readonly string[]).includes(value);
}

export function isAgeVerified(response: Pick<AgeVerificationResponse, "verification">): boolean {
  return response.verification.status === "verified";
}
