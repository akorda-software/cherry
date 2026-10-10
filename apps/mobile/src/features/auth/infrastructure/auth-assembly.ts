import type { AuthCallbackPayload, SessionBundle } from "@cherry/contracts";
import type { AuthProvider, HttpClient } from "@cherry/mobile-shared";

import { createBootstrapSession } from "../application/bootstrap-session";
import { createCompleteAuthCallback } from "../application/complete-auth-callback";
import { createLogoutSession } from "../application/logout-session";
import { createSessionManager } from "../application/session-manager";
import type { SessionShellServices } from "../presentation";
import { createAppleProvider } from "./apple-provider";
import { createGoogleProvider } from "./google-provider";
import { createTestSignInService } from "./test-sign-in-service";

interface AuthDependencies {
  httpClient: HttpClient;
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
  const { httpClient, storage, authApi, sessionApi, device, nativeGoogle, nativeApple, navigation } = deps;
  const sessionManager = createSessionManager({
    storage,
    sessionApi,
    navigation
  });

  const googleProvider = createGoogleProvider({
    signIn: nativeGoogle.signIn,
    getDevice: device.getDevice
  });

  const appleProvider = createAppleProvider({
    signIn: nativeApple.signIn,
    getDevice: device.getDevice
  });

  const completeAuthGoogle = createCompleteAuthCallback({
    provider: "google",
    authApi,
    storage
  });

  const completeAuthApple = createCompleteAuthCallback({
    provider: "apple",
    authApi,
    storage
  });

  const bootstrapSession = createBootstrapSession({
    storage: {
      ...storage,
      read: () => sessionManager.bootstrap()
    }
  });

  const logoutSession = createLogoutSession({
    storage,
    sessionApi
  });

  const testSignIn = createTestSignInService({ httpClient, storage });

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
    logoutSession,
    testSignIn,
    executeAuthenticated: sessionManager.executeWithRefresh
  };
}
