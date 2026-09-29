import { useCallback, useEffect, useRef, useState } from "react";

import type { LocationUpdateRequest } from "@snack/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import { shareLocation, type LocationService, type ShareLocationResult } from "./share-location";

export type ShareLocationStatus = "idle" | "working" | "saved" | "denied" | "blocked" | "unavailable" | "error";

export interface ShareLocationState {
  status: ShareLocationStatus;
  /** Texto para enseñar debajo del botón (qué ha pasado y cómo seguir). */
  message: string | null;
}

export function shareLocationMessage(result: ShareLocationResult): ShareLocationState {
  switch (result.status) {
    case "saved":
      return { status: "saved", message: null };
    case "denied":
      return result.canAskAgain
        ? {
            status: "denied",
            message: "Sin tu zona no podemos enseñarte gente cerca. ¿Lo intentamos otra vez?"
          }
        : {
            status: "blocked",
            message: "La ubicación está desactivada para Snack. Actívala en Ajustes y vuelve: te esperamos aquí."
          };
    case "unavailable":
      return {
        status: "unavailable",
        message: "No conseguimos saber por dónde andas. Revisa que la ubicación del móvil esté activada y prueba otra vez."
      };
    case "error":
      return {
        status: "error",
        message: friendlyErrorMessage(result.error, "No hemos podido guardar tu zona. Inténtalo otra vez.")
      };
  }
}

export interface UseShareLocationOptions {
  service: LocationService;
  send: (request: LocationUpdateRequest) => Promise<void>;
  /** Suscripción a «la app vuelve al primer plano» (p. ej. al volver de Ajustes). */
  subscribeToForeground?: (listener: () => void) => () => void;
}

export interface UseShareLocationResult extends ShareLocationState {
  share(): Promise<ShareLocationResult>;
  openSettings(): Promise<void>;
}

/**
 * Estado del paso de ubicación. Si el permiso estaba bloqueado y la persona
 * vuelve de Ajustes, se reintenta solo en cuanto el permiso está concedido.
 */
export function useShareLocation({ service, send, subscribeToForeground }: UseShareLocationOptions): UseShareLocationResult {
  const [state, setState] = useState<ShareLocationState>({ status: "idle", message: null });
  const statusRef = useRef<ShareLocationStatus>("idle");
  const inFlight = useRef<Promise<ShareLocationResult> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((next: ShareLocationState) => {
    statusRef.current = next.status;

    if (mounted.current) {
      setState(next);
    }
  }, []);

  const share = useCallback(() => {
    if (inFlight.current) {
      return inFlight.current;
    }

    update({ status: "working", message: null });

    const promise = shareLocation(service, send).then((result) => {
      update(shareLocationMessage(result));
      return result;
    });

    inFlight.current = promise;
    void promise.finally(() => {
      inFlight.current = null;
    });
    return promise;
  }, [send, service, update]);

  const openSettings = useCallback(() => service.openSettings(), [service]);

  useEffect(() => {
    if (!subscribeToForeground) {
      return undefined;
    }

    return subscribeToForeground(() => {
      if (statusRef.current !== "blocked" && statusRef.current !== "denied") {
        return;
      }

      void service.getPermission().then(
        (permission) => {
          if (permission.granted) {
            void share();
          }
        },
        () => undefined
      );
    });
  }, [service, share, subscribeToForeground]);

  return { ...state, share, openSettings };
}
