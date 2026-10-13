import { useCallback, useEffect, useRef } from "react";

import type { LocationUpdateRequest } from "@cherry/contracts";
import { createProfileApi } from "@cherry/mobile-shared";

import { toast } from "../../../shared/ui";
import { useAuthedApi } from "../../auth/presentation";
import { discoveryQueueStore } from "../../discovery/application/discovery-runtime";
import { markLocationShared } from "../../location/application/location-refresh";
import type { LocationService } from "../../location/application/share-location";
import { useShareLocation, type ShareLocationStatus } from "../../location/application/use-share-location";
import { subscribeToAppForeground } from "../../location/infrastructure/app-foreground";
import { expoLocationService } from "../../location/infrastructure/expo-location-service";

export const LOCATION_UPDATED_MESSAGE = "Ubicación actualizada";

export interface UpdateMyLocation {
  status: ShareLocationStatus;
  /** Permiso denegado para siempre: la fila lleva a los Ajustes del sistema. */
  blocked: boolean;
  pending: boolean;
  /** Pide permiso si hace falta y envía la zona; si está bloqueado, abre Ajustes del sistema. */
  run(): void;
}

/** Recarga Descubrir si ya tenía cola, para que se vea gente de la nueva zona. */
function reloadDiscoveryIfLoaded() {
  if (discoveryQueueStore.getState().status !== "idle") {
    void discoveryQueueStore.getState().load();
  }
}

/**
 * «Actualizar mi ubicación» (Ajustes): misma lógica que el paso de onboarding (permiso →
 * posición → `POST /api/me/location`), con la misma remediación si el permiso está
 * bloqueado (Ajustes del sistema y reintento solo al volver). Avisa con un toast.
 */
export function useUpdateMyLocation({ service = expoLocationService }: { service?: LocationService } = {}): UpdateMyLocation {
  const callApi = useAuthedApi(createProfileApi);
  const send = useCallback(
    (request: LocationUpdateRequest) => callApi((api) => api.updateLocation(request)),
    [callApi]
  );
  const location = useShareLocation({ service, send, subscribeToForeground: subscribeToAppForeground });
  const { status, message } = location;
  const previous = useRef<ShareLocationStatus>(status);

  useEffect(() => {
    const before = previous.current;
    previous.current = status;

    if (before === status) {
      return;
    }

    if (status === "saved") {
      markLocationShared();
      toast.show({ message: LOCATION_UPDATED_MESSAGE, tone: "success", icon: "pin" });
      reloadDiscoveryIfLoaded();
    } else if (message && status !== "working" && status !== "idle") {
      toast.show({ message, tone: "error" });
    }
  }, [message, status]);

  const blocked = status === "blocked";
  const { share, openSettings } = location;

  const run = useCallback(() => {
    if (blocked) {
      void openSettings().catch(() => undefined);
    } else {
      void share();
    }
  }, [blocked, openSettings, share]);

  return { status, blocked, pending: status === "working", run };
}
