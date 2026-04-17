import type { SessionBundle } from "@snack/contracts";
import type { SessionShellServices } from "../presentation";

const FAKE_SESSION: SessionBundle = {
  accessToken: "dev-access-token",
  accessTokenExpiresAt: "2099-01-01T00:00:00Z",
  refreshToken: "dev-refresh-token",
  refreshTokenExpiresAt: "2099-01-01T00:00:00Z",
  user: {
    id: "dev-user",
    email: "dev@snack.app",
    displayName: "Dev User"
  }
};

export function createMockAuthServices(): SessionShellServices {
  return {
    bootstrapSession: { execute: async () => FAKE_SESSION },
    authProviders: {
      google: {
        authenticate: async () => ({
          provider: "google" as const,
          payload: {
            providerToken: "mock-google-token",
            device: {
              installationId: "dev-device",
              platform: "android" as const,
              deviceName: "Dev Emulator"
            }
          }
        })
      },
      apple: {
        authenticate: async () => ({
          provider: "apple" as const,
          payload: {
            providerToken: "mock-apple-token",
            authorizationCode: "mock-auth-code",
            idToken: "mock-id-token",
            nonce: "mock-nonce",
            device: {
              installationId: "dev-device",
              platform: "ios" as const,
              deviceName: "Dev Simulator"
            }
          }
        })
      }
    },
    completeAuth: {
      google: { execute: async () => FAKE_SESSION },
      apple: { execute: async () => FAKE_SESSION }
    },
    logoutSession: { execute: async () => undefined }
  };
}
