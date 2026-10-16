import type { ChatMessage } from "@cherry/contracts";

export const UNAVAILABLE_REASONS: ReadonlySet<string> = new Set([
  "not_participant", "conversation_not_active", "profile_required", "profile_not_found"
]);

export type TransmitResult =
  | { kind: "ok"; message: ChatMessage }
  | { kind: "unavailable"; reason: string }
  | { kind: "invalid" }
  | { kind: "transient"; ambiguous: boolean };

export function errorCodeOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function unavailableReasonOf(error: unknown): string | null {
  const code = errorCodeOf(error);
  if (code !== null && UNAVAILABLE_REASONS.has(code)) return code;
  // An unrecognized conversation 403 still means access is no longer available.
  return statusOf(error) === 403 ? "conversation_not_active" : null;
}

export function isAuthFatal(error: unknown): boolean {
  return error instanceof Error && (error.message === "session_refresh_failed" || error.message === "missing_session");
}

export function classifyRestError(error: unknown): TransmitResult {
  const reason = unavailableReasonOf(error);
  if (reason) return { kind: "unavailable", reason };
  const status = statusOf(error);
  if (status === 422) return { kind: "invalid" };
  if (status === 429) return { kind: "transient", ambiguous: false };
  return { kind: "transient", ambiguous: status === undefined || status === 0 || status >= 500 };
}

export function classifyChannelError(response?: { reason?: string; errors?: unknown }): TransmitResult {
  if (response?.reason && UNAVAILABLE_REASONS.has(response.reason)) return { kind: "unavailable", reason: response.reason };
  if (response?.errors) return { kind: "invalid" };
  return { kind: "transient", ambiguous: false };
}
