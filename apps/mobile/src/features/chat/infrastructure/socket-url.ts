/**
 * URL del socket de Phoenix a partir de `apiBaseUrl`:
 * `http://host:4000` → `ws://host:4000/socket`, `https://api.x` → `wss://api.x/socket`.
 * Si `apiBaseUrl` está vacío (web servida desde el mismo origen) usa `fallbackOrigin`.
 * Phoenix añade `/websocket?token=…&vsn=…` por su cuenta.
 */
export function socketUrlFromApiBase(apiBaseUrl: string, fallbackOrigin?: string | null): string | null {
  const base = apiBaseUrl.trim() !== "" ? apiBaseUrl.trim() : (fallbackOrigin ?? "").trim();

  if (base === "") {
    return null;
  }

  const match = /^(https?|wss?):\/\/([^/?#]+)([^?#]*)/i.exec(base);

  if (!match) {
    return null;
  }

  const scheme = match[1]!.toLowerCase();
  const host = match[2]!;
  const path = match[3]!.replace(/\/+$/, "");
  const secure = scheme === "https" || scheme === "wss";

  return `${secure ? "wss" : "ws"}://${host}${path}/socket`;
}

/** Origen de la página en web (`window.location.origin`), `null` en nativo. */
export function currentWebOrigin(): string | null {
  const location = (globalThis as { location?: { origin?: unknown } }).location;
  return typeof location?.origin === "string" && location.origin !== "null" ? location.origin : null;
}
