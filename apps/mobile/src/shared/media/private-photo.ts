/** Signed URLs are bearer credentials; parse in memory only, never log/persist them. */
export function signedPhotoInfo(uri: string | undefined | null) {
  if (!uri) return null;
  try {
    const url = new URL(uri);
    const date = url.searchParams.get("X-Amz-Date");
    const ttl = Number(url.searchParams.get("X-Amz-Expires"));
    if (!url.searchParams.has("X-Amz-Signature") || !date || !/^\d{8}T\d{6}Z$/.test(date) || !(ttl > 0)) return null;
    const time = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`);
    // R2 uses path-style addressing: /bucket/<managed object key>.
    const key = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    if (!/^(photos|profiles)\//.test(key) || key.split("/").some((p) => !p || p === "." || p === "..")) return null;
    return { key, expiresAt: time + ttl * 1000 };
  } catch {
    return null;
  }
}
