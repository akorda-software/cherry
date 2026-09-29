import type { HttpClient } from "@snack/mobile-shared";

interface JsonHttpClientOptions {
  apiBaseUrl: string;
  getHeaders?: () => Record<string, string>;
  /** Tiempo máximo por petición (cabeceras + cuerpo). Por defecto `DEFAULT_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Ninguna petición JSON puede quedarse colgada para siempre: varias piezas deduplican por
 * promesa en vuelo (refresco de sesión, badges, recargas) y una promesa eterna las congelaría.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

/** Error de tiempo agotado: es un `TypeError`, como un fallo de red de `fetch`, y se trata igual (transitorio). */
export function createRequestTimeoutError(): TypeError {
  const error = new TypeError("Network request timed out");
  (error as TypeError & { timedOut: true }).timedOut = true;
  return error;
}

/**
 * Ejecuta `run` con una señal que se aborta a los `timeoutMs`. Si se agota el tiempo, rechaza con
 * `createRequestTimeoutError()` aunque `run` no respete la señal.
 */
export function withRequestTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(createRequestTimeoutError());
    }, timeoutMs);
  });

  const work = run(controller.signal).catch((error: unknown) => {
    throw controller.signal.aborted && !isApiError(error) ? createRequestTimeoutError() : error;
  });

  return Promise.race([work, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** Error de la API: `code` es el campo `error` del cuerpo JSON; `body`, el cuerpo entero. */
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

/** Mensaje amable (español de España) para mostrar al usuario; nunca códigos crudos. */
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

export function createJsonHttpClient({
  apiBaseUrl,
  getHeaders = () => ({}),
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}: JsonHttpClientOptions): HttpClient {
  const buildUrl = (path: string) => `${apiBaseUrl}${path}`;

  async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      let code: string | undefined;
      let body: unknown;

      try {
        body = await response.json();
        const errorField = (body as { error?: unknown } | null)?.error;
        if (typeof errorField === "string" && errorField !== "") {
          message = errorField;
          code = errorField;
        }
      } catch {
        // Keep the generic status message when the body is empty or non-JSON.
      }

      const error = new Error(message) as ApiError;
      error.status = response.status;
      error.code = code;
      error.body = body;
      throw error;
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }

  function buildHeaders(): Record<string, string> {
    return {
      ...getHeaders()
    };
  }

  function request<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
    return withRequestTimeout(async (signal) => {
      const response = await fetch(buildUrl(path), { ...init, signal });
      return parseResponse<TResponse>(response);
    }, timeoutMs);
  }

  return {
    async get<TResponse>(path: string): Promise<TResponse> {
      return request<TResponse>(path, {
        method: "GET",
        headers: buildHeaders()
      });
    },

    async post<TResponse>(path: string, body: unknown): Promise<TResponse> {
      return request<TResponse>(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });
    },

    async put<TResponse>(path: string, body: unknown): Promise<TResponse> {
      return request<TResponse>(path, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });
    },

    async delete<TResponse>(path: string, body: unknown): Promise<TResponse> {
      return request<TResponse>(path, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });
    }
  };
}
