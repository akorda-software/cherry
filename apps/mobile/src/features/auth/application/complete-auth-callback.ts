import {
  createAuthCallbackPayload,
  type AuthCallbackPayload,
  type SessionBundle
} from "@snack/contracts";

import { type AuthProvider, type AuthApi } from "@snack/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

interface CreateCompleteAuthCallbackOptions {
  provider: AuthProvider;
  authApi: AuthApi;
  storage: AuthSessionStorage;
  onComplete?: (session: SessionBundle) => Promise<void> | void;
}

export function createCompleteAuthCallback({
  provider,
  authApi,
  storage,
  onComplete
}: CreateCompleteAuthCallbackOptions) {
  return {
    async execute(payload: AuthCallbackPayload): Promise<SessionBundle> {
      const session = await authApi.completeCallback(
        provider,
        createAuthCallbackPayload(payload)
      );

      await storage.write(session);

      await onComplete?.(session);

      return session;
    }
  };
}
