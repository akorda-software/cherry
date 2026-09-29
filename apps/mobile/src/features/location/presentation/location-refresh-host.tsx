import { useEffect } from "react";

import { createProfileApi } from "@snack/mobile-shared";

import { useAppBootstrap } from "../../app-bootstrap";
import { useAuthedApi } from "../../auth/presentation/use-authed-api";
import { onSignOut } from "../../auth/presentation/on-sign-out";
import { useSessionStore } from "../../auth/presentation/session-store";
import { refreshLocationSilently, resetLocationRefresh } from "../application/location-refresh";
import { subscribeToAppForeground } from "../infrastructure/app-foreground";
import { expoLocationService } from "../infrastructure/expo-location-service";

// Otra cuenta en el mismo dispositivo refresca su zona desde cero y nunca recibe la de la anterior.
onSignOut(resetLocationRefresh);

const isSessionActive = () => useSessionStore.getState().status === "signed-in";

/**
 * Sin UI. Con el perfil ya completo, refresca la zona al montar y al volver a primer plano
 * si el permiso de ubicación ya está concedido (nunca lo pide). Silencioso y con throttle.
 */
export function LocationRefreshHost(): null {
  const { state } = useAppBootstrap();
  const profileComplete = state.status === "ready" && state.bootstrap.profile.onboardingRequired === false;
  const callApi = useAuthedApi(createProfileApi);

  useEffect(() => {
    if (!profileComplete) {
      return undefined;
    }

    const refresh = () => {
      void refreshLocationSilently({
        service: expoLocationService,
        send: (request) => callApi((api) => api.updateLocation(request)),
        isSessionActive
      }).catch(() => undefined);
    };

    refresh();
    return subscribeToAppForeground(refresh);
  }, [callApi, profileComplete]);

  return null;
}
