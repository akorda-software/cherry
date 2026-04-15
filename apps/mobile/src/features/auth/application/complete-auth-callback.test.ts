import { describe, expect, it, vi } from "vitest";

import type { SessionBundle } from "@snack/contracts";
import { createSecureSessionStorage } from "@snack/mobile-shared";
import { createCompleteAuthCallback } from "./complete-auth-callback";

const session: SessionBundle = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-12T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

describe("createCompleteAuthCallback", () => {
  it("submits callback credentials to Phoenix and persists the issued session in secure storage", async () => {
    const secureStore = {
      getItemAsync: vi.fn(async () => null),
      setItemAsync: vi.fn(async () => undefined),
      deleteItemAsync: vi.fn(async () => undefined)
    };
    const insecureStore = { setItem: vi.fn() };

    const service = createCompleteAuthCallback({
      provider: "google",
      authApi: {
        completeCallback: vi.fn(async () => session)
      },
      storage: createSecureSessionStorage({ secureStore })
    });

    await expect(
      service.execute({
        providerToken: "google-token",
        device: {
          installationId: "install-1",
          platform: "android",
          deviceName: "Pixel 9"
        }
      })
    ).resolves.toEqual(session);

    expect(secureStore.setItemAsync).toHaveBeenCalledOnce();
    expect(insecureStore.setItem).not.toHaveBeenCalled();
  });

  it("forwards Apple-specific callback fields to Phoenix before persisting the session", async () => {
    const authApi = {
      completeCallback: vi.fn(async () => session)
    };

    const service = createCompleteAuthCallback({
      provider: "apple",
      authApi,
      storage: {
        read: async () => null,
        write: async () => undefined,
        clear: async () => undefined
      }
    });

    await service.execute({
      providerToken: "apple-token",
      authorizationCode: "auth-code",
      idToken: "id-token",
      nonce: "nonce-123",
      device: {
        installationId: "install-2",
        platform: "ios",
        deviceName: "iPhone 15"
      }
    });

    expect(authApi.completeCallback).toHaveBeenCalledWith("apple", {
      providerToken: "apple-token",
      authorizationCode: "auth-code",
      idToken: "id-token",
      nonce: "nonce-123",
      device: {
        installationId: "install-2",
        platform: "ios",
        deviceName: "iPhone 15"
      }
    });
  });

  it("runs an optional completion callback after secure persistence succeeds", async () => {
    const onComplete = vi.fn(async () => undefined);
    const service = createCompleteAuthCallback({
      provider: "google",
      authApi: {
        completeCallback: vi.fn(async () => session)
      },
      storage: {
        read: async () => null,
        write: async () => undefined,
        clear: async () => undefined
      },
      onComplete
    });

    await service.execute({
      providerToken: "google-token",
      device: {
        installationId: "install-3",
        platform: "android",
        deviceName: "Pixel 9"
      }
    });

    expect(onComplete).toHaveBeenCalledWith(session);
  });
});
