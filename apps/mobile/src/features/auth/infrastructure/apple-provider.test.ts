import { describe, expect, it } from "vitest";

import { createAppleProvider } from "./apple-provider";

describe("createAppleProvider", () => {
  it("maps native Apple credentials into the backend callback payload with nonce support", async () => {
    const provider = createAppleProvider({
      signIn: async () => ({
        providerToken: "apple-token",
        authorizationCode: "auth-code",
        idToken: "id-token",
        nonce: "nonce-123"
      }),
      getDevice: async () => ({
        installationId: "device-2",
        platform: "ios",
        deviceName: "iPhone 15"
      })
    });

    await expect(provider.authenticate()).resolves.toEqual({
      provider: "apple",
      payload: {
        providerToken: "apple-token",
        authorizationCode: "auth-code",
        idToken: "id-token",
        nonce: "nonce-123",
        device: {
          installationId: "device-2",
          platform: "ios",
          deviceName: "iPhone 15"
        }
      }
    });
  });
});
