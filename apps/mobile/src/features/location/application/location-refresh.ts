import type { LocationUpdateRequest } from "@cherry/contracts";

import { isValidFix, toLocationUpdateRequest, type LocationFix, type LocationService } from "./share-location";

/**
 * Refresco silencioso de la zona al abrir la app o volver a primer plano, para que quien se
 * muda deje de ver gente de su zona antigua. Nunca pide permiso (solo lo usa si ya está
 * concedido), nunca enseña errores y como mucho envía una vez cada 30 min (el backend,
 * además, ignora actualizaciones de menos de 60 s).
 */
export const LOCATION_REFRESH_INTERVAL_MS = 30 * 60_000;

export type LocationRefreshOutcome =
  /** Enviada hace menos de `LOCATION_REFRESH_INTERVAL_MS`. */
  | "throttled"
  /** Ya había un refresco en vuelo: se reutiliza. */
  | "in_flight"
  /** Permiso no concedido: no se pide aquí. */
  | "no_permission"
  /** Sin posición (GPS apagado, timeout, datos raros). */
  | "unavailable"
  /** La sesión cambió o se cerró mientras tanto: no se envía nada. */
  | "cancelled"
  | "sent"
  | "failed";

export interface LocationRefreshOptions {
  service: Pick<LocationService, "getPermission" | "getCurrentFix">;
  send: (request: LocationUpdateRequest) => Promise<void>;
  /** `false` si ya no hay sesión (tras cerrar sesión no se envía nada). */
  isSessionActive?: () => boolean;
  now?: () => number;
  minIntervalMs?: number;
}

let lastSharedAt = -Infinity;
/** Sube al cerrar sesión: un refresco empezado con la cuenta anterior nunca llega a enviarse. */
let generation = 0;
let inFlight: { generation: number; promise: Promise<LocationRefreshOutcome> } | null = null;

/** Apunta que la zona acaba de enviarse (también desde la acción manual de Ajustes u onboarding). */
export function markLocationShared(at: number = Date.now()) {
  lastSharedAt = at;
}

/** Cierre de sesión (o tests): olvida el último envío y anula lo que esté en vuelo. */
export function resetLocationRefresh() {
  generation += 1;
  lastSharedAt = -Infinity;
  inFlight = null;
}

export function refreshLocationSilently({
  service,
  send,
  isSessionActive = () => true,
  now = Date.now,
  minIntervalMs = LOCATION_REFRESH_INTERVAL_MS
}: LocationRefreshOptions): Promise<LocationRefreshOutcome> {
  if (inFlight && inFlight.generation === generation) {
    return inFlight.promise.then(() => "in_flight" as const);
  }

  if (now() - lastSharedAt < minIntervalMs) {
    return Promise.resolve("throttled");
  }

  const runGeneration = generation;
  const stillCurrent = () => runGeneration === generation && isSessionActive();

  const run = async (): Promise<LocationRefreshOutcome> => {
    try {
      const permission = await service.getPermission();
      if (!permission.granted) {
        return "no_permission";
      }
    } catch {
      return "no_permission";
    }

    let fix: LocationFix | null;
    try {
      fix = await service.getCurrentFix();
    } catch {
      fix = null;
    }

    if (!isValidFix(fix)) {
      return "unavailable";
    }

    if (!stillCurrent()) {
      return "cancelled";
    }

    try {
      await send(toLocationUpdateRequest(fix));
    } catch {
      return "failed";
    }

    if (runGeneration === generation) {
      lastSharedAt = now();
    }
    return "sent";
  };

  const promise = run().finally(() => {
    if (inFlight?.promise === promise) {
      inFlight = null;
    }
  });

  inFlight = { generation: runGeneration, promise };
  return promise;
}
