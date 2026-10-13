/**
 * Verificación de edad (D-2026-10-09, `docs/compliance/02-mayoria-de-edad.md`).
 *
 * `GET /api/me/verification` y `POST /api/me/verification/nfc`. El servidor solo guarda
 * «mayor de edad: sí», el método, la fecha y una huella con clave del documento.
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
}

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
 * - 409 `document_already_used` (otra cuenta) | `already_verified` (con otro documento)
 * - 403 `verification_revoked`
 * - 429 `too_many_attempts` (+ `retryAfter` en segundos y cabecera `Retry-After`)
 * - 503 `age_verification_unavailable` (la instancia no tiene clave de huella)
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
  | "age_verification_required";

export function isDocumentNotVerifiedReason(value: unknown): value is DocumentNotVerifiedReason {
  return typeof value === "string" && (DOCUMENT_NOT_VERIFIED_REASONS as readonly string[]).includes(value);
}

export function isAgeVerified(response: Pick<AgeVerificationResponse, "verification">): boolean {
  return response.verification.status === "verified";
}
