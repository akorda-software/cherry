import { type PropsWithChildren, useEffect } from "react";

import { useSessionStore, type SessionShellServices } from "./session-store";

export {
  useSessionShell,
  useSessionStore,
  type AuthShellState,
  type BusyProvider,
  type SessionShellServices
} from "./session-store";

export function SessionShellProvider({
  children,
  services
}: PropsWithChildren<{ services?: SessionShellServices }>) {
  const configure = useSessionStore((s) => s.configure);

  useEffect(() => {
    if (services) {
      configure(services);
    }
  }, [configure, services]);

  return <>{children}</>;
}
