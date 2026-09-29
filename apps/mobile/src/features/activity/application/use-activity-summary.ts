import { useEffect } from "react";
import { AppState } from "react-native";

import type { ActivitySummary } from "@snack/contracts";
import { createActivityApi } from "@snack/mobile-shared";

import { useAuthedApi } from "../../auth/presentation";
import { ACTIVITY_POLL_INTERVAL_MS, acquireActivityPolling, type AppStateLike } from "./activity-poller";
import { useActivityStore } from "./activity-store";

/**
 * Mantiene al día los contadores de actividad (badges de Likes y Chats): consulta al montar,
 * al volver a primer plano y cada ~45 s. Se puede montar en varios sitios a la vez (un único
 * sondeo compartido). Devuelve el último resumen conocido.
 */
export function useActivitySummary({
  intervalMs = ACTIVITY_POLL_INTERVAL_MS
}: { intervalMs?: number } = {}): ActivitySummary | null {
  const callApi = useAuthedApi(createActivityApi);

  useEffect(
    () =>
      acquireActivityPolling({
        fetchSummary: () => callApi((api) => api.getSummary()),
        intervalMs,
        appState: (AppState as unknown as AppStateLike | undefined) ?? null
      }),
    [callApi, intervalMs]
  );

  return useActivityStore((state) => state.summary);
}

/** Montable en cualquier layout de la zona privada para tener los badges desde el arranque. */
export function ActivitySummaryHost(): null {
  useActivitySummary();
  return null;
}
