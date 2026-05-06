import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useSessionShell } from "../../auth/presentation";
import type { AppBootstrap } from "../domain/bootstrap";
import type { AppBootstrapService } from "../infrastructure/backend-bootstrap-service";

export type AppBootstrapState =
  | { status: "idle"; bootstrap: null; error: null }
  | { status: "loading"; bootstrap: null; error: null }
  | { status: "ready"; bootstrap: AppBootstrap; error: null }
  | { status: "error"; bootstrap: null; error: string };

interface AppBootstrapContextValue {
  state: AppBootstrapState;
  refreshBootstrap(): Promise<void>;
}

const AppBootstrapContext = createContext<AppBootstrapContextValue | null>(null);

export function AppBootstrapProvider({
  children,
  service
}: PropsWithChildren<{ service: AppBootstrapService }>) {
  const { state: sessionState, executeAuthenticated } = useSessionShell();
  const [state, setState] = useState<AppBootstrapState>({ status: "idle", bootstrap: null, error: null });

  const loadBootstrap = useCallback(async () => {
    if (sessionState.status !== "signed-in") {
      setState({ status: "idle", bootstrap: null, error: null });
      return;
    }

    setState({ status: "loading", bootstrap: null, error: null });

    try {
      const bootstrap = await executeAuthenticated((accessToken) => service.fetchBootstrap(accessToken));
      setState({ status: "ready", bootstrap, error: null });
    } catch (error) {
      setState({
        status: "error",
        bootstrap: null,
        error: error instanceof Error ? error.message : "Unable to load app bootstrap"
      });
    }
  }, [executeAuthenticated, service, sessionState.status]);

  useEffect(() => {
    let cancelled = false;

    if (sessionState.status !== "signed-in") {
      setState({ status: "idle", bootstrap: null, error: null });
      return () => {
        cancelled = true;
      };
    }

    setState({ status: "loading", bootstrap: null, error: null });

    void executeAuthenticated((accessToken) => service.fetchBootstrap(accessToken)).then(
      (bootstrap) => {
        if (!cancelled) {
          setState({ status: "ready", bootstrap, error: null });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            bootstrap: null,
            error: error instanceof Error ? error.message : "Unable to load app bootstrap"
          });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [executeAuthenticated, service, sessionState.status]);

  const value = useMemo(
    () => ({
      state,
      refreshBootstrap: loadBootstrap
    }),
    [loadBootstrap, state]
  );

  return <AppBootstrapContext.Provider value={value}>{children}</AppBootstrapContext.Provider>;
}

export function useAppBootstrap() {
  const context = useContext(AppBootstrapContext);

  if (context === null) {
    throw new Error("useAppBootstrap must be used within AppBootstrapProvider");
  }

  return context;
}
