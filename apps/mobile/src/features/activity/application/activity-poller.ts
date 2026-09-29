import type { ActivitySummary } from "@snack/contracts";

import { useActivityStore } from "./activity-store";

/**
 * Consulta periódica de `GET /api/me/summary` compartida por todos los que la necesiten
 * (recuento de referencias: se puede montar desde varias pantallas sin duplicar peticiones).
 * Consulta al empezar, al volver a primer plano y cada `intervalMs` mientras la app está activa.
 */

export const ACTIVITY_POLL_INTERVAL_MS = 45_000;
/** Dos consultas seguidas (foco + primer plano) dentro de esta ventana se agrupan en una. */
export const ACTIVITY_MIN_GAP_MS = 2_000;

type AppStateStatus = "active" | "background" | "inactive" | "unknown" | "extension" | string;

export interface AppStateLike {
  currentState?: AppStateStatus | null;
  addEventListener(type: "change", listener: (state: AppStateStatus) => void): { remove(): void } | undefined;
}

export interface ActivityPollingOptions {
  fetchSummary(): Promise<ActivitySummary>;
  intervalMs?: number;
  appState?: AppStateLike | null;
}

let refCount = 0;
let fetcher: (() => Promise<ActivitySummary>) | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove(): void } | undefined;
let inFlight: Promise<void> | null = null;
let lastRequestAt = -Infinity;
let appStateRef: AppStateLike | null = null;

function isForeground(): boolean {
  const state = appStateRef?.currentState;
  return state === undefined || state === null || state === "active" || state === "unknown";
}

/** Pide el resumen ya (si hay alguien escuchando). Agrupa peticiones muy seguidas. */
export function refreshActivitySummary({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (!fetcher) {
    return Promise.resolve();
  }

  if (inFlight) {
    return inFlight;
  }

  if (!force && Date.now() - lastRequestAt < ACTIVITY_MIN_GAP_MS) {
    return Promise.resolve();
  }

  lastRequestAt = Date.now();
  const run = fetcher;

  inFlight = run()
    .then(
      (summary) => {
        // Si nadie escucha ya (cierre de sesión), no resucitamos datos.
        if (refCount > 0) {
          useActivityStore.getState().setSummary(summary);
        }
      },
      () => {
        // Sin red: los badges se quedan como estaban hasta la próxima.
      }
    )
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Empieza (o se suma a) la consulta periódica. Devuelve la función para soltarla. */
export function acquireActivityPolling({
  fetchSummary,
  intervalMs = ACTIVITY_POLL_INTERVAL_MS,
  appState = null
}: ActivityPollingOptions): () => void {
  refCount += 1;
  fetcher = fetchSummary;

  if (refCount === 1) {
    appStateRef = appState;
    intervalHandle = setInterval(() => {
      if (isForeground()) {
        void refreshActivitySummary();
      }
    }, intervalMs);

    appStateSubscription = appState?.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshActivitySummary();
      }
    });

    void refreshActivitySummary({ force: true });
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    refCount = Math.max(0, refCount - 1);

    if (refCount === 0) {
      stopPolling();
    }
  };
}

function stopPolling() {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  appStateSubscription?.remove();
  appStateSubscription = undefined;
  appStateRef = null;
  fetcher = null;
  lastRequestAt = -Infinity;
}

/** Solo tests: vuelve al estado inicial. */
export function resetActivityPollingForTests() {
  refCount = 0;
  inFlight = null;
  stopPolling();
}
