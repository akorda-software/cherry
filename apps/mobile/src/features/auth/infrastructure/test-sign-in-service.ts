import type { SessionBundle } from "@snack/contracts";

import type { HttpClient } from "@snack/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

const TEST_LOGIN_PATH = "/api/auth/dev/test-login";

export function createTestSignInService({
  httpClient,
  storage
}: {
  httpClient: HttpClient;
  storage: AuthSessionStorage;
}) {
  return {
    async execute(): Promise<SessionBundle> {
      const session = await httpClient.post<SessionBundle>(TEST_LOGIN_PATH, {});
      await storage.write(session);
      return session;
    }
  };
}
