import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { AuthCallbackPayload, SessionBundle } from "@snack/contracts";
import type { AuthProvider } from "@snack/mobile-shared";

import { describeAuthError } from "./auth-error-copy";

export type BusyProvider = AuthProvider | "test";

export type AuthShellState =
  | { status: "loading"; session: null; error: null; busyProvider: null }
  | { status: "signed-out"; session: null; error: string | null; busyProvider: BusyProvider | null }
  | { status: "signed-in"; session: SessionBundle; error: null; busyProvider: null };

interface NativeAuthResult {
  provider: AuthProvider;
  payload: AuthCallbackPayload;
}

interface SessionBootstrapService {
  execute(): Promise<SessionBundle | null>;
}

interface CompleteAuthService {
  execute(payload: AuthCallbackPayload): Promise<SessionBundle>;
}

interface NativeAuthService {
  authenticate(): Promise<NativeAuthResult>;
}

interface LogoutSessionService {
  execute(session: SessionBundle | null): Promise<void>;
}

interface TestSignInService {
  /** Sin `email`, el usuario de test compartido; con `email`, esa persona (se crea si no existe). */
  execute(email?: string): Promise<SessionBundle>;
}

export interface SessionShellServices {
  bootstrapSession: SessionBootstrapService;
  completeAuth: Record<AuthProvider, CompleteAuthService>;
  authProviders: Record<AuthProvider, NativeAuthService>;
  logoutSession: LogoutSessionService;
  testSignIn?: TestSignInService;
  executeAuthenticated?<T>(request: (accessToken: string) => Promise<T>): Promise<T>;
}

interface SessionStoreState {
  status: AuthShellState["status"];
  session: SessionBundle | null;
  error: string | null;
  busyProvider: BusyProvider | null;

  services: SessionShellServices;
  configure(services: SessionShellServices): void;
  bootstrap(): Promise<void>;
  signInWith(provider: AuthProvider): Promise<void>;
  signInAsTest(email?: string): Promise<void>;
  signOut(): Promise<void>;
  executeAuthenticated<T>(request: (accessToken: string) => Promise<T>): Promise<T>;
}

const defaultServices: SessionShellServices = {
  bootstrapSession: { execute: async () => null },
  completeAuth: {
    google: { execute: async () => Promise.reject(new Error("Google auth is not configured")) },
    apple: { execute: async () => Promise.reject(new Error("Apple auth is not configured")) }
  },
  authProviders: {
    google: { authenticate: async () => Promise.reject(new Error("Google provider is not configured")) },
    apple: { authenticate: async () => Promise.reject(new Error("Apple provider is not configured")) }
  },
  logoutSession: { execute: async () => undefined },
  executeAuthenticated: async () => Promise.reject(new Error("Authenticated requests are not configured"))
};

export const useSessionStore = create<SessionStoreState>((set, get) => ({
  status: "loading",
  session: null,
  error: null,
  busyProvider: null,
  services: defaultServices,

  configure: (services) => {
    set({ services });
    void get().bootstrap();
  },

  bootstrap: async () => {
    const { services } = get();
    set({ status: "loading", session: null, error: null, busyProvider: null });

    try {
      const session = await services.bootstrapSession.execute();
      if (session === null) {
        set({ status: "signed-out", session: null, error: null, busyProvider: null });
        return;
      }
      set({ status: "signed-in", session, error: null, busyProvider: null });
    } catch (error) {
      set({
        status: "signed-out",
        session: null,
        error: describeAuthError(error, "restore"),
        busyProvider: null
      });
    }
  },

  signInWith: async (provider) => {
    const { services } = get();
    set({ status: "signed-out", session: null, error: null, busyProvider: provider });

    try {
      const authentication = await services.authProviders[provider].authenticate();
      const session = await services.completeAuth[authentication.provider].execute(authentication.payload);
      set({ status: "signed-in", session, error: null, busyProvider: null });
    } catch (error) {
      set({
        status: "signed-out",
        session: null,
        error: describeAuthError(error, provider),
        busyProvider: null
      });
    }
  },

  signInAsTest: async (email) => {
    const { services } = get();
    if (!services.testSignIn) {
      return;
    }

    set({ status: "signed-out", session: null, error: null, busyProvider: "test" });

    try {
      const session = await services.testSignIn.execute(email);
      set({ status: "signed-in", session, error: null, busyProvider: null });
    } catch (error) {
      set({
        status: "signed-out",
        session: null,
        error: describeAuthError(error, "test"),
        busyProvider: null
      });
    }
  },

  signOut: async () => {
    const { services, session, status } = get();
    const currentSession = status === "signed-in" ? session : null;

    try {
      await services.logoutSession.execute(currentSession);
    } catch {
      // La sesión local ya se ha borrado; si revocarla en el servidor falla (sin red,
      // cuenta ya borrada), la persona sale igualmente.
    } finally {
      set({ status: "signed-out", session: null, error: null, busyProvider: null });
    }
  },

  executeAuthenticated: async (request) => {
    const { services, status, session } = get();

    if (services.executeAuthenticated) {
      return services.executeAuthenticated(request) as Promise<ReturnType<typeof request>>;
    }

    if (status !== "signed-in" || session === null) {
      throw new Error("missing_session");
    }

    return request(session.accessToken);
  }
}));

export function useSessionShell(): {
  state: AuthShellState;
  signInWith(provider: AuthProvider): Promise<void>;
  signInAsTest?(email?: string): Promise<void>;
  signOut(): Promise<void>;
  executeAuthenticated<T>(request: (accessToken: string) => Promise<T>): Promise<T>;
} {
  const state = useSessionStore(
    useShallow((s) => ({
      status: s.status,
      session: s.session,
      error: s.error,
      busyProvider: s.busyProvider
    }))
  ) as AuthShellState;

  const hasTestSignIn = useSessionStore((s) => Boolean(s.services.testSignIn));
  const { signInWith, signInAsTest, signOut, executeAuthenticated } = useSessionStore.getState();

  return {
    state,
    signInWith,
    signInAsTest: hasTestSignIn ? signInAsTest : undefined,
    signOut,
    executeAuthenticated
  };
}
