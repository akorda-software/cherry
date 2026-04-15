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

  return {
    async bootstrap(): Promise<SessionBundle | null> {
      const session = await storage.read();

      if (session === null) {
        return null;
      }

      if (new Date(session.accessTokenExpiresAt).getTime() > now().getTime()) {
        return session;
      }

      return refreshAndPersist(session);
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

        const refreshed = await refreshAndPersist(session);

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
