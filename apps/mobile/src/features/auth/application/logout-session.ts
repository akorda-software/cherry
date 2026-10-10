import type { SessionBundle } from "@cherry/contracts";

import type { SessionApi } from "@cherry/mobile-shared";
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
