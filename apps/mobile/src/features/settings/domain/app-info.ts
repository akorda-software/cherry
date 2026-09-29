/** Solo enlaces web de verdad: nada de esquemas raros ni URLs a medio escribir. */
export function normalizeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(trimmed) ? trimmed : null;
}

/**
 * URL del repositorio para el enlace «Ver el código». Primero `extra.sourceUrl` de la config de
 * Expo y, si no, `EXPO_PUBLIC_SOURCE_URL`. Sin URL configurada no se enseña enlace.
 */
export function resolveSourceUrl(extra: Record<string, unknown> | undefined, envValue: string | undefined): string | null {
  return normalizeSourceUrl(extra?.sourceUrl) ?? normalizeSourceUrl(envValue);
}

/** «0.4.1» o «0.4.1 (12)» si hay número de build nativo. */
export function formatAppVersion(version: string | null | undefined, build?: string | null): string | null {
  const cleanVersion = version?.trim();
  if (!cleanVersion) {
    return null;
  }

  const cleanBuild = build?.trim();
  return cleanBuild ? `${cleanVersion} (${cleanBuild})` : cleanVersion;
}
