import { useCallback, useEffect } from "react";

import { createSettingsApi } from "@snack/mobile-shared";

import { haptics, toast } from "../../../shared/ui";
import { refreshBootstrap, useAppBootstrap } from "../../app-bootstrap";
import { useAuthedApi } from "../../auth/presentation";
import {
  useProfilePauseController,
  type ProfilePauseController
} from "../application/use-profile-pause-controller";

export const PAUSED_MESSAGE = "Estás en pausa. Nadie nuevo te ve, pero tus chats siguen aquí.";

export interface ProfilePause extends ProfilePauseController {
  /** Pausa o reanuda con aviso amable (toast) y háptico. */
  toggle(next: boolean): Promise<void>;
}

/**
 * Pausa/reanuda tu perfil (`POST /api/me/pause|unpause`) y refresca el bootstrap para que el
 * resto de la app (Descubrir, banners) lo sepa. Lo usan la pestaña Yo y Ajustes.
 */
export function useProfilePause(): ProfilePause {
  const callApi = useAuthedApi(createSettingsApi);
  const { state } = useAppBootstrap();
  const isPaused = state.status === "ready" ? state.bootstrap.profile.isPaused : false;

  const pause = useCallback(() => callApi((api) => api.pause()), [callApi]);
  const unpause = useCallback(() => callApi((api) => api.unpause()), [callApi]);

  const controller = useProfilePauseController({ isPaused, pause, unpause, refresh: refreshBootstrap });
  const { setPaused, error, clearError } = controller;

  useEffect(() => {
    if (error) {
      toast.show({ message: error, tone: "error" });
      clearError();
    }
  }, [clearError, error]);

  const toggle = useCallback(
    async (next: boolean) => {
      const saved = await setPaused(next);
      if (!saved) {
        return;
      }

      if (next) {
        // El sello «En pausa» cae con un golpe; el toast de éxito ya trae su propio háptico.
        haptics.medium();
        toast.show({ message: "Perfil en pausa. Tomarte un respiro está bien.", tone: "info", icon: "moon" });
      } else {
        toast.show({ message: "¡Has vuelto! Ya te pueden ver de nuevo.", tone: "success", icon: "sparkles" });
      }
    },
    [setPaused]
  );

  return { ...controller, toggle };
}
