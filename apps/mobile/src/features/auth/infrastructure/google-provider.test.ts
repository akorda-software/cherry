import { describe, expect, it } from "vitest";

import { createGoogleProvider } from "./google-provider";

describe("createGoogleProvider", () => {
  it("maps native Google credentials into the backend callback payload", async () => {
    const provider = createGoogleProvider({
      signIn: async () => ({ providerToken: "google-token" }),
      getDevice: async () => ({
        installationId: "device-1",
        platform: "android",
        deviceName: "Pixel 9"
      })
    });

    await expect(provider.authenticate()).resolves.toEqual({
      provider: "google",
      payload: {
        providerToken: "google-token",
        device: {
          installationId: "device-1",
          platform: "android",
          deviceName: "Pixel 9"
        }
      }
    });
  });
});
