import { create } from "zustand";

import type { AuthShellState } from "../../auth/presentation";
import type { AppBootstrap } from "../domain/bootstrap";
import type { AppBootstrapService } from "../infrastructure/backend-bootstrap-service";

type BootstrapStatus = "idle" | "loading" | "ready" | "error";

export type AppBootstrapState =
  | { status: "idle"; bootstrap: null; error: null }
  | { status: "loading"; bootstrap: null; error: null }
  | { status: "ready"; bootstrap: AppBootstrap; error: null }
  | { status: "error"; bootstrap: null; error: string };

interface BootstrapStoreState {
  status: BootstrapStatus;
  bootstrap: AppBootstrap | null;
  error: string | null;

  service: AppBootstrapService | null;
  executeAuthenticated: ((request: (accessToken: string) => Promise<unknown>) => Promise<unknown>) | null;
  sessionStatus: AuthShellState["status"] | null;

  configure(deps: {
    service: AppBootstrapService;
    executeAuthenticated: <T>(request: (accessToken: string) => Promise<T>) => Promise<T>;
  }): void;
  setSessionStatus(status: AuthShellState["status"]): void;
  refresh(): Promise<void>;
}

function toError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load app bootstrap";
}

export const useBootstrapStore = create<BootstrapStoreState>((set, get) => ({
  status: "idle",
  bootstrap: null,
  error: null,
  service: null,
  executeAuthenticated: null,
  sessionStatus: null,

  configure: (deps) => set(deps),

  setSessionStatus: (sessionStatus) => {
    set({ sessionStatus });
    void get().refresh();
  },

  refresh: async () => {
    const { service, executeAuthenticated, sessionStatus } = get();

    if (sessionStatus !== "signed-in") {
      set({ status: "idle", bootstrap: null, error: null });
      return;
    }

    if (service === null || executeAuthenticated === null) {
      return;
    }

    set({ status: "loading", bootstrap: null, error: null });

    try {
      const bootstrap = (await executeAuthenticated((token) => service.fetchBootstrap(token))) as AppBootstrap;
      set({ status: "ready", bootstrap, error: null });
    } catch (error) {
      set({ status: "error", bootstrap: null, error: toError(error) });
    }
  }
}));

export function refreshBootstrap(): Promise<void> {
  return useBootstrapStore.getState().refresh();
}

export function useAppBootstrap(): {
  state: AppBootstrapState;
  refreshBootstrap(): Promise<void>;
} {
  const status = useBootstrapStore((s) => s.status);
  const bootstrap = useBootstrapStore((s) => s.bootstrap);
  const error = useBootstrapStore((s) => s.error);

  let state: AppBootstrapState;
  if (status === "ready" && bootstrap !== null) {
    state = { status: "ready", bootstrap, error: null };
  } else if (status === "error") {
    state = { status: "error", bootstrap: null, error: error ?? "Unable to load app bootstrap" };
  } else if (status === "loading") {
    state = { status: "loading", bootstrap: null, error: null };
  } else {
    state = { status: "idle", bootstrap: null, error: null };
  }

  return { state, refreshBootstrap };
}
