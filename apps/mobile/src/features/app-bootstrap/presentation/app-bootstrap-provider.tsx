import { type PropsWithChildren, useEffect } from "react";

import { useSessionShell } from "../../auth/presentation";
import type { AppBootstrapService } from "../infrastructure/backend-bootstrap-service";
import { useBootstrapStore } from "./bootstrap-store";

export { useAppBootstrap, refreshBootstrap } from "./bootstrap-store";
export type { AppBootstrapState } from "./bootstrap-store";

export function AppBootstrapProvider({
  children,
  service
}: PropsWithChildren<{ service: AppBootstrapService }>) {
  const { state: sessionState, executeAuthenticated } = useSessionShell();
  const configure = useBootstrapStore((s) => s.configure);
  const setSessionStatus = useBootstrapStore((s) => s.setSessionStatus);

  useEffect(() => {
    configure({ service, executeAuthenticated });
  }, [configure, executeAuthenticated, service]);

  useEffect(() => {
    setSessionStatus(sessionState.status);
  }, [setSessionStatus, sessionState.status]);

  return <>{children}</>;
}
