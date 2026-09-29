export const REPORT_REASONS = [
  "fake_profile",
  "inappropriate_photos",
  "harassment",
  "spam",
  "underage",
  "offensive_bio",
  "other"
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = "open" | "reviewed" | "dismissed" | "actioned";

/** Body de `POST /api/users/:profileId/report`. `details` opcional, máx. 1000 caracteres (se recorta). */
export interface ReportRequest {
  reason: ReportReason;
  details?: string;
}

export interface ProfileReport {
  id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  insertedAt: string;
}

export interface ReportResponse {
  report: ProfileReport;
}

export const MAX_REPORT_DETAILS_LENGTH = 1000;

/**
 * Errores de safety:
 * - 404 `profile_not_found` (sin perfil propio o destino inexistente)
 * - 422 `cannot_block_self` | `cannot_report_self` | `invalid_report_reason` | `details_too_long`
 */
export type SafetyErrorCode =
  | "profile_not_found"
  | "cannot_block_self"
  | "cannot_report_self"
  | "invalid_report_reason"
  | "details_too_long";

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}
