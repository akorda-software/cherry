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
      await storage.clear();

      if (session === null) {
        return;
      }

      await sessionApi.revoke(session.refreshToken);
    }
  };
}
