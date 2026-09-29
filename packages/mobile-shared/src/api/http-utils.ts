import type { CursorPageQuery } from "@snack/contracts";

import type { HttpClient } from "./auth-api";

type QueryValue = string | number | boolean | null | undefined;

/** `path?k=v&...` omitiendo `undefined`, `null` y cadenas vacías (en el orden de las claves). */
export function buildQueryPath(path: string, query?: Record<string, QueryValue>): string {
  if (!query) {
    return path;
  }

  const parts = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return parts.length === 0 ? path : `${path}?${parts.join("&")}`;
}

/** Query de páginas por cursor: `limit` primero y `cursor` después (formato histórico del feed). */
export function buildCursorPath(path: string, query?: CursorPageQuery): string {
  return buildQueryPath(path, { limit: query?.limit, cursor: query?.cursor });
}

/** Segmento de ruta seguro para IDs recibidos del backend. */
export function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * `HttpClient.delete` es opcional por compatibilidad con clientes antiguos; los endpoints DELETE
 * lo necesitan (`createJsonHttpClient` de la app lo implementa). Envía `{}` como body por defecto.
 */
export async function httpDelete<TResponse>(
  httpClient: HttpClient,
  path: string,
  body: unknown = {}
): Promise<TResponse> {
  if (!httpClient.delete) {
    throw new Error("HttpClient.delete is required for DELETE endpoints");
  }

  return httpClient.delete<TResponse>(path, body);
}
