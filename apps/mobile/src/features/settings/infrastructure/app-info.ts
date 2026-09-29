import Constants from "expo-constants";

import { formatAppVersion, resolveSourceUrl } from "../domain/app-info";

export interface AppInfo {
  /** Versión legible («0.0.0»), o `null` si la config no la trae. */
  version: string | null;
  /** Repositorio del código, si la instancia lo ha configurado. */
  sourceUrl: string | null;
}

/** Lee versión y URL del código de la config de Expo (y de `EXPO_PUBLIC_SOURCE_URL`). */
export function readAppInfo(): AppInfo {
  const expoConfig = Constants.expoConfig as { version?: string; extra?: Record<string, unknown> } | null;

  return {
    version: formatAppVersion(expoConfig?.version),
    // Expo solo sustituye `process.env.EXPO_PUBLIC_*` si se escribe literal.
    sourceUrl: resolveSourceUrl(expoConfig?.extra, process.env.EXPO_PUBLIC_SOURCE_URL)
  };
}
