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
      },
      cryptoModule: {
        CryptoDigestAlgorithm: { SHA256: "sha256" },
        CryptoEncoding: { HEX: "hex" },
        getRandomBytes: vi.fn(() => Uint8Array.from([0xaa, 0xbb, 0xcc])),
        digestStringAsync: vi.fn(async () => "hashed-nonce")
      } as never
    });

    const result = await adapter.signIn();

    expect(result).toEqual({
      providerToken: "apple-identity-token",
      authorizationCode: "auth-code-123",
      idToken: "apple-identity-token",
      nonce: "aabbcc"
    });
  });

  it("passes requestedScopes with FULL_NAME and EMAIL plus the hashed nonce", async () => {
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
      },
      cryptoModule: {
        CryptoDigestAlgorithm: { SHA256: "sha256" },
        CryptoEncoding: { HEX: "hex" },
        getRandomBytes: vi.fn(() => Uint8Array.from([0x01, 0x02, 0x03])),
        digestStringAsync: vi.fn(async () => "hashed-010203")
      } as never
    });

    await adapter.signIn();

    expect(signInAsync).toHaveBeenCalledWith({
      requestedScopes: [0, 1],
      nonce: "hashed-010203"
    });
  });

  it("throws when Apple Sign-In is not available on device", async () => {
    const adapter = createAppleNativeAdapter({
      module: {
        isAvailableAsync: vi.fn(async () => false),
        signInAsync: vi.fn()
      },
      cryptoModule: {
        CryptoDigestAlgorithm: { SHA256: "sha256" },
        CryptoEncoding: { HEX: "hex" },
        getRandomBytes: vi.fn(),
        digestStringAsync: vi.fn()
      } as never
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
      },
      cryptoModule: {
        CryptoDigestAlgorithm: { SHA256: "sha256" },
        CryptoEncoding: { HEX: "hex" },
        getRandomBytes: vi.fn(() => Uint8Array.from([0x01])),
        digestStringAsync: vi.fn(async () => "hashed")
      } as never
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
      },
      cryptoModule: {
        CryptoDigestAlgorithm: { SHA256: "sha256" },
        CryptoEncoding: { HEX: "hex" },
        getRandomBytes: vi.fn(() => Uint8Array.from([0x01])),
        digestStringAsync: vi.fn(async () => "hashed")
      } as never
    });

    await expect(adapter.signIn()).rejects.toThrow(
      "Apple Sign-In did not return an authorization code"
    );
  });
});
