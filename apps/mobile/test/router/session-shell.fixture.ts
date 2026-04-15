import type { SessionBundle } from "@snack/contracts";

import type { SessionShellServices } from "../../src/features/auth/presentation";

export const sessionFixture: SessionBundle = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-13T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-20T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

const defaultDevice = {
  installationId: "device-1",
  platform: "ios" as const,
  deviceName: "iPhone"
};

export function createSessionShellServices(
  overrides?: Partial<SessionShellServices>
): SessionShellServices {
  return {
    bootstrapSession: {
      execute: async () => null
    },
    authProviders: {
      google: {
        authenticate: async () => ({
          provider: "google" as const,
          payload: { providerToken: "google-token", device: defaultDevice }
        })
      },
      apple: {
        authenticate: async () => ({
          provider: "apple" as const,
          payload: {
            providerToken: "apple-token",
            authorizationCode: "auth-code",
            idToken: "id-token",
            nonce: "nonce",
            device: defaultDevice
          }
        })
      }
    },
    completeAuth: {
      google: { execute: async () => sessionFixture },
      apple: { execute: async () => sessionFixture }
    },
    logoutSession: {
      execute: async () => undefined
    },
    ...overrides
  };
}
