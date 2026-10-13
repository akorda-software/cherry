import type { OnboardingStep } from "@cherry/contracts";

import { apiErrorCode, friendlyErrorMessage, isApiError } from "../../../shared/api";

/**
 * Cómo reacciona Descubrir a un fallo del feed:
 * - `paused`: 403 `profile_paused` → estado «Tu perfil está en pausa».
 * - `incomplete`: 403 `profile_incomplete` → llevar al onboarding.
 * - `invalid_cursor`: 422 → recargar sin cursor.
 * - `error`: cualquier otra cosa → mensaje amable + reintentar.
 */
export type FeedFailure =
  | { kind: "paused" }
  | { kind: "incomplete"; nextOnboardingStep: OnboardingStep | null }
  | { kind: "invalid_cursor" }
  | { kind: "error"; message: string };

export function classifyFeedError(error: unknown): FeedFailure {
  const code = apiErrorCode(error);

  if (code === "profile_paused") {
    return { kind: "paused" };
  }

  if (code === "profile_incomplete") {
    const body = isApiError(error) ? (error.body as { nextOnboardingStep?: unknown } | undefined) : undefined;
    const step = typeof body?.nextOnboardingStep === "string" ? (body.nextOnboardingStep as OnboardingStep) : null;

    return { kind: "incomplete", nextOnboardingStep: step };
  }

  if (code === "invalid_cursor") {
    return { kind: "invalid_cursor" };
  }

  return {
    kind: "error",
    message: friendlyErrorMessage(error, "No hemos podido traer perfiles ahora mismo. Inténtalo otra vez.")
  };
}

/**
 * Resultado de registrar un like/dislike que falló:
 * - `settled`: el backend ya lo tiene o la persona ya no está visible (409/404/422 propios):
 *   la card se queda fuera sin molestar.
 * - `rollback`: fallo de red o del servidor → la card vuelve a su sitio con un aviso.
 */
export function classifyActionError(error: unknown): "settled" | "rollback" {
  const code = apiErrorCode(error);

  if (
    code === "already_swiped" ||
    code === "profile_not_found" ||
    code === "cannot_swipe_self" ||
    code === "invalid_action_type"
  ) {
    return "settled";
  }

  return "rollback";
}
