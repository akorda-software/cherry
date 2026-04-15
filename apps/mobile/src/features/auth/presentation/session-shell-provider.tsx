import type { AuthCallbackPayload, SessionBundle } from "@snack/contracts";
import type { AuthProvider } from "@snack/mobile-shared";
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

export type AuthShellState =
  | { status: "loading"; session: null; error: null; busyProvider: null }
  | { status: "signed-out"; session: null; error: string | null; busyProvider: AuthProvider | null }
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

export interface SessionShellServices {
  bootstrapSession: SessionBootstrapService;
  completeAuth: Record<AuthProvider, CompleteAuthService>;
  authProviders: Record<AuthProvider, NativeAuthService>;
  logoutSession: LogoutSessionService;
}

interface SessionShellContextValue {
  state: AuthShellState;
  signInWith(provider: AuthProvider): Promise<void>;
  signOut(): Promise<void>;
}

const defaultServices: SessionShellServices = {
  bootstrapSession: { execute: async () => null },
  completeAuth: {
    google: { execute: async () => Promise.reject(new Error("Google auth is not configured")) },
    apple: { execute: async () => Promise.reject(new Error("Apple auth is not configured")) }
  },
  authProviders: {
    google: {
      authenticate: async () => Promise.reject(new Error("Google provider is not configured"))
    },
    apple: {
      authenticate: async () => Promise.reject(new Error("Apple provider is not configured"))
    }
  },
  logoutSession: { execute: async () => undefined }
};

const SessionShellContext = createContext<SessionShellContextValue | null>(null);

export function SessionShellProvider({
  children,
  services = defaultServices
}: PropsWithChildren<{ services?: SessionShellServices }>) {
  const [state, setState] = useState<AuthShellState>({
    status: "loading",
    session: null,
    error: null,
    busyProvider: null
  });

  useEffect(() => {
    let cancelled = false;

    void services.bootstrapSession.execute().then(
      (session) => {
        if (cancelled) {
          return;
        }

        if (session === null) {
          setState({ status: "signed-out", session: null, error: null, busyProvider: null });
          return;
        }

        setState({ status: "signed-in", session, error: null, busyProvider: null });
      },
      (error: unknown) => {
        if (cancelled) {
          return;
        }

        setState({
          status: "signed-out",
          session: null,
          error: error instanceof Error ? error.message : "Unable to restore session",
          busyProvider: null
        });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [services]);

  const signInWith = useCallback(
    async (provider: AuthProvider) => {
      setState({ status: "signed-out", session: null, error: null, busyProvider: provider });

      try {
        const authentication = await services.authProviders[provider].authenticate();
        const session = await services.completeAuth[authentication.provider].execute(
          authentication.payload
        );

        setState({ status: "signed-in", session, error: null, busyProvider: null });
      } catch (error) {
        setState({
          status: "signed-out",
          session: null,
          error: error instanceof Error ? error.message : "Unable to sign in",
          busyProvider: null
        });
      }
    },
    [services]
  );

  const signOut = useCallback(async () => {
    const currentSession = state.status === "signed-in" ? state.session : null;
    await services.logoutSession.execute(currentSession);
    setState({ status: "signed-out", session: null, error: null, busyProvider: null });
  }, [services, state]);

  const value = useMemo(
    () => ({
      state,
      signInWith,
      signOut
    }),
    [signInWith, signOut, state]
  );

  return <SessionShellContext.Provider value={value}>{children}</SessionShellContext.Provider>;
}

export function useSessionShell() {
  const context = useContext(SessionShellContext);

  if (context === null) {
    throw new Error("useSessionShell must be used within SessionShellProvider");
  }

  return context;
}
