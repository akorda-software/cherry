import { vi } from "vitest";

export interface FakeRequest {
  method: string;
  path: string;
  body: unknown;
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
}

/**
 * Sustituye `fetch` por un backend de mentira: `handler` recibe método, ruta y cuerpo JSON
 * y devuelve estado + cuerpo. Deshazlo con `vi.unstubAllGlobals()`.
 */
export function stubBackend(handler: (request: FakeRequest) => FakeResponse) {
  const calls: FakeRequest[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const request: FakeRequest = {
      method: (init?.method ?? "GET").toUpperCase(),
      path: url.pathname,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    };
    calls.push(request);

    const { status = 200, body } = handler(request);
    return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" }
    });
  });

  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    fetchMock,
    /** Llamadas a una ruta concreta (y método, si se da). */
    callsTo(path: string, method?: string) {
      return calls.filter((call) => call.path === path && (method === undefined || call.method === method));
    }
  };
}
