import type { LocationUpdateRequest } from "@snack/contracts";

/**
 * Compartir la ubicación aproximada: permiso → posición actual → `POST /api/me/location`.
 * El backend la redondea a una rejilla de 500 m; nunca se guarda la exacta.
 */
export interface LocationPermissionState {
  granted: boolean;
  /** `false` = el sistema ya no volverá a preguntar: solo queda ir a Ajustes. */
  canAskAgain: boolean;
}

export interface LocationFix {
  latitude: number;
  longitude: number;
  /** Metros (puede faltar en algunos navegadores). */
  accuracyMeters: number | null;
  /** Epoch ms de la lectura. */
  timestamp: number;
}

export interface LocationService {
  getPermission(): Promise<LocationPermissionState>;
  requestPermission(): Promise<LocationPermissionState>;
  /** Posición actual (o la última conocida reciente); `null` si no hay forma de obtenerla. */
  getCurrentFix(): Promise<LocationFix | null>;
  openSettings(): Promise<void>;
}

export type ShareLocationResult =
  | { status: "saved" }
  | { status: "denied"; canAskAgain: boolean }
  | { status: "unavailable" }
  | { status: "error"; error: unknown };

export function toLocationUpdateRequest(fix: LocationFix): LocationUpdateRequest {
  const request: LocationUpdateRequest = {
    latitude: fix.latitude,
    longitude: fix.longitude,
    recordedAt: new Date(fix.timestamp).toISOString()
  };

  // Backend guarda `accuracy_meters` como entero: un 35.7 daría 422.
  if (typeof fix.accuracyMeters === "number" && Number.isFinite(fix.accuracyMeters) && fix.accuracyMeters >= 0) {
    request.accuracyMeters = Math.round(fix.accuracyMeters);
  }

  return request;
}

export function isValidFix(fix: LocationFix | null | undefined): fix is LocationFix {
  return (
    !!fix &&
    Number.isFinite(fix.latitude) &&
    Number.isFinite(fix.longitude) &&
    Math.abs(fix.latitude) <= 90 &&
    Math.abs(fix.longitude) <= 180 &&
    Number.isFinite(fix.timestamp)
  );
}

export async function ensureLocationPermission(service: LocationService): Promise<LocationPermissionState> {
  const current = await service.getPermission();

  if (current.granted || !current.canAskAgain) {
    return current;
  }

  return service.requestPermission();
}

export async function shareLocation(
  service: LocationService,
  send: (request: LocationUpdateRequest) => Promise<void>
): Promise<ShareLocationResult> {
  let permission: LocationPermissionState;

  try {
    permission = await ensureLocationPermission(service);
  } catch (error) {
    return { status: "error", error };
  }

  if (!permission.granted) {
    return { status: "denied", canAskAgain: permission.canAskAgain };
  }

  let fix: LocationFix | null;

  try {
    fix = await service.getCurrentFix();
  } catch {
    fix = null;
  }

  if (!isValidFix(fix)) {
    return { status: "unavailable" };
  }

  try {
    await send(toLocationUpdateRequest(fix));
    return { status: "saved" };
  } catch (error) {
    return { status: "error", error };
  }
}
