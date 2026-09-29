import type { HttpClient } from "@snack/mobile-shared";

interface JsonHttpClientOptions {
  apiBaseUrl: string;
  getHeaders?: () => Record<string, string>;
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
  getHeaders = () => ({})
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

  return {
    async get<TResponse>(path: string): Promise<TResponse> {
      const response = await fetch(buildUrl(path), {
        method: "GET",
        headers: buildHeaders()
      });

      return parseResponse<TResponse>(response);
    },

    async post<TResponse>(path: string, body: unknown): Promise<TResponse> {
      const response = await fetch(buildUrl(path), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });

      return parseResponse<TResponse>(response);
    },

    async put<TResponse>(path: string, body: unknown): Promise<TResponse> {
      const response = await fetch(buildUrl(path), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });

      return parseResponse<TResponse>(response);
    },

    async delete<TResponse>(path: string, body: unknown): Promise<TResponse> {
      const response = await fetch(buildUrl(path), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...buildHeaders()
        },
        body: JSON.stringify(body)
      });

      return parseResponse<TResponse>(response);
    }
  };
}
