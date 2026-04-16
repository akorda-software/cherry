import { describe, expect, it, vi } from "vitest";

import { createAppleAuthNonce } from "./apple-auth-nonce";

describe("createAppleAuthNonce", () => {
  it("returns a raw nonce and its SHA-256 hash", async () => {
    const digestStringAsync = vi.fn(async () => "hashed-nonce");

    const result = await createAppleAuthNonce({
      CryptoDigestAlgorithm: { SHA256: "sha256" },
      CryptoEncoding: { HEX: "hex" },
      getRandomBytes: vi.fn(() => Uint8Array.from([0x0a, 0x1b, 0x2c])),
      digestStringAsync
    });

    expect(result).toEqual({
      rawNonce: "0a1b2c",
      hashedNonce: "hashed-nonce"
    });

    expect(digestStringAsync).toHaveBeenCalledWith("sha256", "0a1b2c", { encoding: "hex" });
  });
});
