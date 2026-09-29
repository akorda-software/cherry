import type { SessionBundle } from "@snack/contracts";

import type { SessionApi } from "@snack/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

interface NavigationPort {
  goToSignedOut(): void;
}

interface CreateSessionManagerOptions {
  storage: AuthSessionStorage;
  sessionApi: SessionApi;
  navigation: NavigationPort;
  now?: () => Date;
}

export function createSessionManager({
  storage,
  sessionApi,
  navigation,
  now = () => new Date()
}: CreateSessionManagerOptions) {
  async function refreshAndPersist(session: SessionBundle): Promise<SessionBundle | null> {
    try {
      const refreshed = await sessionApi.refresh(session.refreshToken);
      await storage.write(refreshed);
      return refreshed;
    } catch {
      await storage.clear();
      navigation.goToSignedOut();
      return null;
    }
  }

  // Un solo refresco a la vez: el backend rota el refresh token y reusarlo revoca la sesión
  // entera, así que varios 401 simultáneos (volver a primer plano) deben compartir el refresco.
  let refreshInFlight: Promise<SessionBundle | null> | null = null;

  function refreshOnce(session: SessionBundle): Promise<SessionBundle | null> {
    if (refreshInFlight === null) {
      refreshInFlight = refreshAndPersist(session).finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  }

  return {
    async bootstrap(): Promise<SessionBundle | null> {
      const session = await storage.read();

      if (session === null) {
        return null;
      }

      if (new Date(session.accessTokenExpiresAt).getTime() > now().getTime()) {
        return session;
      }

      return refreshOnce(session);
    },

    async executeWithRefresh<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
      const session = await storage.read();

      if (session === null) {
        navigation.goToSignedOut();
        throw new Error("missing_session");
      }

      try {
        return await request(session.accessToken);
      } catch (error) {
        if (!isUnauthorized(error)) {
          throw error;
        }

        // Otra petición pudo rotar la sesión mientras esta volaba: reintenta con la guardada.
        const latest = await storage.read();
        if (latest != null && latest.accessToken !== session.accessToken) {
          return request(latest.accessToken);
        }

        const refreshed = await refreshOnce(latest ?? session);

        if (refreshed === null) {
          throw new Error("session_refresh_failed");
        }

        return request(refreshed.accessToken);
      }
    }
  };
}

function isUnauthorized(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && error.status === 401;
}
