import { describe, expect, it, vi } from "vitest";

import { createGoogleNativeAdapter } from "./google-native-adapter";

describe("createGoogleNativeAdapter", () => {
  it("configures the module on creation and returns providerToken from signIn", async () => {
    const configure = vi.fn();
    const signIn = vi.fn(
      async () =>
        ({
          type: "success",
          data: { idToken: "google-id-token", serverAuthCode: null }
        }) as const
    );
    const hasPlayServices = vi.fn(async () => true);
    const signOut = vi.fn(async () => null);

    const adapter = createGoogleNativeAdapter({
      module: { configure, signIn, hasPlayServices, signOut },
      webClientId: "test-web-client-id"
    });

    expect(configure).toHaveBeenCalledWith({
      webClientId: "test-web-client-id",
      iosClientId: undefined,
      offlineAccess: false
    });

    const result = await adapter.signIn();

    expect(result).toEqual({ providerToken: "google-id-token" });
    expect(hasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
    expect(signIn).toHaveBeenCalled();
  });

  it("forgets the last Google account before signing in, so the account picker shows", async () => {
    const calls: string[] = [];
    const adapter = createGoogleNativeAdapter({
      module: {
        configure: vi.fn(),
        hasPlayServices: vi.fn(async () => true),
        signOut: vi.fn(async () => {
          calls.push("signOut");
          return null;
        }),
        signIn: vi.fn(async () => {
          calls.push("signIn");
          return { type: "success", data: { idToken: "google-id-token", serverAuthCode: null } } as const;
        })
      },
      webClientId: "test-web-client-id"
    });

    await adapter.signIn();

    expect(calls).toEqual(["signOut", "signIn"]);
  });

  it("still signs in if forgetting the last account fails", async () => {
    const adapter = createGoogleNativeAdapter({
      module: {
        configure: vi.fn(),
        hasPlayServices: vi.fn(async () => true),
        signOut: vi.fn(async () => Promise.reject(new Error("SIGN_OUT_FAILED"))),
        signIn: vi.fn(
          async () => ({ type: "success", data: { idToken: "google-id-token", serverAuthCode: null } }) as const
        )
      },
      webClientId: "test-web-client-id"
    });

    await expect(adapter.signIn()).resolves.toEqual({ providerToken: "google-id-token" });
  });

  it("throws if Google Play Services is not available", async () => {
    const adapter = createGoogleNativeAdapter({
      module: {
        configure: vi.fn(),
        signIn: vi.fn(),
        hasPlayServices: vi.fn(async () => false),
        signOut: vi.fn(async () => null)
      },
      webClientId: "test-web-client-id"
    });

    await expect(adapter.signIn()).rejects.toThrow("Google Play Services is required");
  });

  it("throws if signIn returns cancelled response", async () => {
    const adapter = createGoogleNativeAdapter({
      module: {
        configure: vi.fn(),
        signIn: vi.fn(async () => ({ type: "cancelled", data: null }) as const),
        hasPlayServices: vi.fn(async () => true),
        signOut: vi.fn(async () => null)
      },
      webClientId: "test-web-client-id"
    });

    await expect(adapter.signIn()).rejects.toThrow("Google Sign-In was cancelled");
  });

  it("throws if signIn returns null idToken", async () => {
    const adapter = createGoogleNativeAdapter({
      module: {
        configure: vi.fn(),
        signIn: vi.fn(
          async () =>
            ({ type: "success", data: { idToken: null, serverAuthCode: null } }) as const
        ),
        hasPlayServices: vi.fn(async () => true),
        signOut: vi.fn(async () => null)
      },
      webClientId: "test-web-client-id"
    });

    await expect(adapter.signIn()).rejects.toThrow("Google Sign-In did not return an ID token");
  });

  it("passes iosClientId when provided", () => {
    const configure = vi.fn();

    createGoogleNativeAdapter({
      module: {
        configure,
        signIn: vi.fn(),
        hasPlayServices: vi.fn(),
        signOut: vi.fn()
      },
      webClientId: "web-id",
      iosClientId: "ios-id"
    });

    expect(configure).toHaveBeenCalledWith({
      webClientId: "web-id",
      iosClientId: "ios-id",
      offlineAccess: false
    });
  });
});
