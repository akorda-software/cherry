import type { HttpClient } from "@snack/mobile-shared";

interface JsonHttpClientOptions {
  apiBaseUrl: string;
  getHeaders?: () => Record<string, string>;
}

interface HttpError extends Error {
  status?: number;
}

export function createJsonHttpClient({
  apiBaseUrl,
  getHeaders = () => ({})
}: JsonHttpClientOptions): HttpClient {
  const buildUrl = (path: string) => `${apiBaseUrl}${path}`;

  async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;

      try {
        const body = (await response.json()) as { error?: string };
        if (typeof body.error === "string" && body.error !== "") {
          message = body.error;
        }
      } catch {
        // Keep the generic status message when the body is empty or non-JSON.
      }

      const error = new Error(message) as HttpError;
      error.status = response.status;
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
