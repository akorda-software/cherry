import type { ProfileReport, ReportReason, ReportRequest } from "@cherry/contracts";

import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";
import { normalizeReportDetails } from "../domain/report-reasons";

export interface SafetyActionDeps {
  block(profileId: string): Promise<void>;
  report(profileId: string, request: ReportRequest): Promise<ProfileReport>;
}

export type SafetyOutcome<T = void> = { ok: true; value: T } | { ok: false; message: string };

/** Bloquear es idempotente; si la persona ya no existe, el resultado es el mismo: no la verás. */
export async function blockProfile(deps: SafetyActionDeps, profileId: string): Promise<SafetyOutcome> {
  try {
    await deps.block(profileId);
    return { ok: true, value: undefined };
  } catch (error) {
    const code = apiErrorCode(error);

    if (code === "profile_not_found") {
      return { ok: true, value: undefined };
    }

    if (code === "cannot_block_self") {
      return { ok: false, message: "No puedes bloquearte a ti." };
    }

    return {
      ok: false,
      message: friendlyErrorMessage(error, "No hemos podido bloquear ahora mismo. Inténtalo otra vez.")
    };
  }
}

export async function reportProfile(
  deps: SafetyActionDeps,
  profileId: string,
  reason: ReportReason,
  details?: string | null
): Promise<SafetyOutcome<ProfileReport>> {
  const normalized = normalizeReportDetails(details);
  const request: ReportRequest = normalized === undefined ? { reason } : { reason, details: normalized };

  try {
    const report = await deps.report(profileId, request);
    return { ok: true, value: report };
  } catch (error) {
    switch (apiErrorCode(error)) {
      case "invalid_report_reason":
        return { ok: false, message: "Elige uno de los motivos de la lista." };
      case "details_too_long":
        return { ok: false, message: "Los detalles son demasiado largos (máximo 1000 caracteres)." };
      case "cannot_report_self":
        return { ok: false, message: "No puedes reportarte a ti." };
      case "profile_not_found":
        return {
          ok: false,
          message: "Este perfil ya no está disponible, así que no podemos recibir el reporte."
        };
      default:
        return {
          ok: false,
          message: friendlyErrorMessage(error, "No hemos podido enviar el reporte. Inténtalo otra vez.")
        };
    }
  }
}
