import { describe, expect, it, vi } from "vitest";

import { createAppleNativeAdapter } from "./apple-native-adapter";

describe("createAppleNativeAdapter", () => {
  it("returns Apple credentials when Sign-In is available", async () => {
    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => true),
        signInAsync: vi.fn(async () => ({
          user: "apple-user-id",
          state: null,
          identityToken: "apple-identity-token",
          authorizationCode: "auth-code-123",
          fullName: {
            namePrefix: null,
            givenName: "John",
            middleName: null,
            familyName: "Doe",
            nameSuffix: null,
            nickname: null
          },
          email: "john@privaterelay.appleid.com",
          realUserStatus: 2
        }))
      }
    });

    const result = await adapter.signIn();

    expect(result).toEqual({
      providerToken: "apple-identity-token",
      authorizationCode: "auth-code-123",
      idToken: "apple-identity-token",
      nonce: "requested"
    });
  });

  it("passes requestedScopes with FULL_NAME and EMAIL", async () => {
    const signInAsync = vi.fn(async () => ({
      user: "id",
      state: null,
      identityToken: "token",
      authorizationCode: "code",
      fullName: null,
      email: null,
      realUserStatus: 1
    }));

    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => true),
        signInAsync
      }
    });

    await adapter.signIn();

    expect(signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1]
    });
  });

  it("throws when Apple Sign-In is not available on device", async () => {
    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => false),
        signInAsync: vi.fn()
      }
    });

    await expect(adapter.signIn()).rejects.toThrow("Apple Sign-In is not available");
  });

  it("throws when identityToken is null", async () => {
    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => true),
        signInAsync: vi.fn(async () => ({
          user: "id",
          state: null,
          identityToken: null,
          authorizationCode: "code",
          fullName: null,
          email: null,
          realUserStatus: 1
        }))
      }
    });

    await expect(adapter.signIn()).rejects.toThrow("Apple Sign-In did not return an identity token");
  });

  it("throws when authorizationCode is null", async () => {
    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => true),
        signInAsync: vi.fn(async () => ({
          user: "id",
          state: null,
          identityToken: "token",
          authorizationCode: null,
          fullName: null,
          email: null,
          realUserStatus: 1
        }))
      }
    });

    await expect(adapter.signIn()).rejects.toThrow(
      "Apple Sign-In did not return an authorization code"
    );
  });
});
