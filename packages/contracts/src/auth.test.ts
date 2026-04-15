import { describe, expect, it } from "vitest";

import { createAuthCallbackPayload } from "./auth";

describe("createAuthCallbackPayload", () => {
  it("builds the google callback DTO with the required device metadata", () => {
    expect(
      createAuthCallbackPayload({
        providerToken: "google-token",
        device: {
          installationId: "install-1",
          platform: "ios",
          deviceName: "iPhone 15"
        }
      })
    ).toEqual({
      providerToken: "google-token",
      device: {
        installationId: "install-1",
        platform: "ios",
        deviceName: "iPhone 15"
      }
    });
  });

  it("preserves optional Apple callback fields when present", () => {
    expect(
      createAuthCallbackPayload({
        providerToken: "apple-token",
        authorizationCode: "auth-code",
        idToken: "id-token",
        nonce: "nonce-123",
        device: {
          installationId: "install-2",
          platform: "ios",
          deviceName: "iPhone 15 Pro"
        }
      })
    ).toEqual({
      providerToken: "apple-token",
      authorizationCode: "auth-code",
      idToken: "id-token",
      nonce: "nonce-123",
      device: {
        installationId: "install-2",
        platform: "ios",
        deviceName: "iPhone 15 Pro"
      }
    });
  });
});
