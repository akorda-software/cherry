import type { AuthCallbackPayload, SessionBundle } from "@snack/contracts";
import type { AuthProvider } from "@snack/mobile-shared";

import { createSessionManager } from "../application/session-manager";
import type { SessionShellServices } from "../presentation";

interface AuthDependencies {
  googleWebClientId: string;
  googleIosClientId?: string;
  storage: {
    read(): Promise<SessionBundle | null>;
    write(session: SessionBundle): Promise<void>;
    clear(): Promise<void>;
  };
  authApi: {
    completeCallback(provider: AuthProvider, payload: AuthCallbackPayload): Promise<SessionBundle>;
  };
  sessionApi: {
    refresh(refreshToken: string): Promise<SessionBundle>;
    revoke(refreshToken: string): Promise<void>;
  };
  device: {
    getDevice(): Promise<{
      installationId: string;
      platform: "ios" | "android";
      deviceName: string;
    }>;
  };
  nativeGoogle: {
    signIn(): Promise<{ providerToken: string }>;
  };
  nativeApple: {
    signIn(): Promise<{
      providerToken: string;
      authorizationCode: string;
      idToken: string;
      nonce: string;
    }>;
  };
  navigation: {
    goToSignedOut(): void;
  };
}

export function assembleAuthServices(deps: AuthDependencies): SessionShellServices {
  const { storage, authApi, sessionApi, device, nativeGoogle, nativeApple, navigation } = deps;
  const sessionManager = createSessionManager({
    storage,
    sessionApi,
    navigation
  });

  const googleProvider = {
    async authenticate() {
      const [credential, deviceInfo] = await Promise.all([
        nativeGoogle.signIn(),
        device.getDevice()
      ]);

      return {
        provider: "google" as const,
        payload: {
          providerToken: credential.providerToken,
          device: deviceInfo
        } satisfies AuthCallbackPayload
      };
    }
  };

  const appleProvider = {
    async authenticate() {
      const [credential, deviceInfo] = await Promise.all([
        nativeApple.signIn(),
        device.getDevice()
      ]);

      return {
        provider: "apple" as const,
        payload: {
          providerToken: credential.providerToken,
          authorizationCode: credential.authorizationCode,
          idToken: credential.idToken,
          nonce: credential.nonce,
          device: deviceInfo
        } satisfies AuthCallbackPayload
      };
    }
  };

  const completeAuthGoogle = {
    async execute(payload: AuthCallbackPayload): Promise<SessionBundle> {
      const session = await authApi.completeCallback("google", payload);
      await storage.write(session);
      return session;
    }
  };

  const completeAuthApple = {
    async execute(payload: AuthCallbackPayload): Promise<SessionBundle> {
      const session = await authApi.completeCallback("apple", payload);
      await storage.write(session);
      return session;
    }
  };

  const bootstrapSession = {
    async execute(): Promise<SessionBundle | null> {
      return sessionManager.bootstrap();
    }
  };

  const logoutSession = {
    async execute(session: SessionBundle | null): Promise<void> {
      await storage.clear();
      if (session !== null) {
        await sessionApi.revoke(session.refreshToken);
      }
    }
  };

  return {
    bootstrapSession,
    authProviders: {
      google: googleProvider,
      apple: appleProvider
    },
    completeAuth: {
      google: completeAuthGoogle,
      apple: completeAuthApple
    },
    logoutSession
  };
}
