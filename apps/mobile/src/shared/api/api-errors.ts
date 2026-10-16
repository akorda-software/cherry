/** API failure: code is the JSON body's `error` field; body preserves the full response. */
export interface ApiError extends Error {
  status?: number;
  code?: string;
  body?: unknown;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && ("status" in error || "code" in error);
}

export function apiErrorCode(error: unknown): string | null {
  return isApiError(error) && typeof error.code === "string" ? error.code : null;
}

/** User-facing copy, not a raw provider or backend error. */
export function friendlyErrorMessage(error: unknown, fallback = "Algo se ha torcido. Inténtalo otra vez."): string {
  if (isApiError(error)) {
    if (error.status === undefined || error.status === 0) {
      return "Parece que no hay conexión. Revisa tu internet e inténtalo de nuevo.";
    }
    if (error.status >= 500) {
      return "Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar.";
    }
    if (error.status === 429) {
      return "Vas muy rápido. Respira un segundo y vuelve a intentarlo.";
    }
  } else if (error instanceof TypeError) {
    return "Parece que no hay conexión. Revisa tu internet e inténtalo de nuevo.";
  }
  return fallback;
}
