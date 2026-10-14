import { useCallback, useState } from "react";

import type { AuthShellState } from "../../auth/presentation";
import { useSessionShell } from "../../auth/presentation";
import { BootSplash } from "../../../shared/ui/composites/boot-splash";
import { type AppBootstrapState, useAppBootstrap } from "./bootstrap-store";

/**
 * La app ya sabe adónde ir: sin sesión (al login) o con sesión y el bootstrap resuelto (onboarding,
 * Descubrir o el error de conexión). Es lo mismo que espera `app/index.tsx` antes de redirigir.
 */
export function isBootSettled(session: AuthShellState["status"], bootstrap: AppBootstrapState["status"]): boolean {
  if (session === "loading") {
    return false;
  }

  if (session === "signed-out") {
    return true;
  }

  return bootstrap === "ready" || bootstrap === "error";
}

/** Splash animado de arranque: se monta una vez sobre la app y se quita al fundirse. */
export function BootSplashGate() {
  const { state } = useSessionShell();
  const { state: bootstrapState } = useAppBootstrap();
  const [visible, setVisible] = useState(true);
  const hide = useCallback(() => setVisible(false), []);

  if (!visible) {
    return null;
  }

  return <BootSplash onFinish={hide} ready={isBootSettled(state.status, bootstrapState.status)} />;
}
