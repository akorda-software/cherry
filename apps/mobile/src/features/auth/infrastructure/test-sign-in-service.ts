import type { SessionBundle } from "@cherry/contracts";

import type { HttpClient } from "@cherry/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

const TEST_LOGIN_PATH = "/api/auth/dev/test-login";

/**
 * Entrada de desarrollo (`POST /api/auth/dev/test-login`, solo con el flag del backend).
 * Sin `email` entra como el usuario de test compartido; con `email`, como esa persona
 * (la crea si no existe, p. ej. un usuario nuevo o la demo `demo@cherry.dev`).
 */
export function createTestSignInService({
  httpClient,
  storage
}: {
  httpClient: HttpClient;
  storage: AuthSessionStorage;
}) {
  return {
    async execute(email?: string): Promise<SessionBundle> {
      const trimmed = email?.trim();
      const body = trimmed ? { email: trimmed } : {};
      const session = await httpClient.post<SessionBundle>(TEST_LOGIN_PATH, body);
      await storage.write(session);
      return session;
    }
  };
}
