import type { HttpClient } from "@cherry/mobile-shared";
import type { ApiError } from "./api-errors";
import { DEFAULT_REQUEST_TIMEOUT_MS, withRequestTimeout } from "./request-timeout";

interface JsonHttpClientOptions {
  apiBaseUrl: string;
  getHeaders?: () => Record<string, string>;
  /** Tiempo máximo por petición (cabeceras + cuerpo). Por defecto `DEFAULT_REQUEST_TIMEOUT_MS`. */
  timeoutMs?: number;
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
