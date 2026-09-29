import type { SessionBundle } from "@snack/contracts";

import type { SessionApi } from "@snack/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

interface CreateLogoutSessionOptions {
  storage: AuthSessionStorage;
  sessionApi: Pick<SessionApi, "revoke">;
}

export function createLogoutSession({ storage, sessionApi }: CreateLogoutSessionOptions) {
  return {
    async execute(session: SessionBundle | null): Promise<void> {
      // El refresh token rota: el guardado es el vigente (el de la sesión en memoria puede ser viejo).
      const stored = session === null ? null : await storage.read().catch(() => null);
      await storage.clear();

      if (session === null) {
        return;
      }

      const current = stored !== null && stored.user.id === session.user.id ? stored : session;
      await sessionApi.revoke(current.refreshToken);
    }
  };
}
