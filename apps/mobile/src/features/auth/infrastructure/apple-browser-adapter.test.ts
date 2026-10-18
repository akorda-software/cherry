import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type * as Crypto from "expo-crypto";
import type * as WebBrowser from "expo-web-browser";
import type { HttpClient } from "@cherry/mobile-shared";
import { createAppleBrowserAdapter } from "./apple-browser-adapter";
import { createAppleProvider } from "./apple-provider";
import { defaultAppleAvailability } from "../presentation/auth-action-list";

const grant = "g".repeat(43);

function setup(options: { result?: (state: string) => unknown; authorization?: (nonce: string) => string; scheme?: string } = {}) {
  let request: Record<string, string> = {};
  const post = vi.fn(async (_path: string, body: unknown) => {
    request = body as Record<string, string>;
    return { authorizationUrl: options.authorization?.(request.nonce) ??
      `https://appleid.apple.com/auth/authorize?response_type=code&nonce=${request.nonce}` };
  });
  const openAuthSessionAsync = vi.fn(async () => options.result?.(request.state) ?? {
    type: "success", url: `cherry://auth/apple?code=${grant}&state=${request.state}`
  });
  const crypto = {
    CryptoDigestAlgorithm: { SHA256: "sha256" }, CryptoEncoding: { HEX: "hex", BASE64: "base64" },
    getRandomBytes: vi.fn((length: number) => new Uint8Array(randomBytes(length))),
    digestStringAsync: vi.fn(async (_algorithm: string, value: string, { encoding }: { encoding: "hex" | "base64" }) => createHash("sha256").update(value).digest(encoding))
  } as unknown as typeof Crypto;
  const adapter = createAppleBrowserAdapter({
    httpClient: { post } as unknown as HttpClient,
    browser: { openAuthSessionAsync } as unknown as Pick<typeof WebBrowser, "openAuthSessionAsync">,
    scheme: options.scheme ?? "cherry", cryptoModule: crypto
  });
  return { adapter, post, openAuthSessionAsync, crypto, request: () => request };
}

describe("Apple browser adapter", () => {
  it("opens Apple only and returns a one-use grant with its verifier, never an Apple token", async () => {
    const test = setup();
    const credential = await test.adapter.signIn();
    expect(credential.providerToken).toBe(`apple-browser:${grant}`);
    expect(credential).not.toHaveProperty("idToken");
    expect(credential).not.toHaveProperty("authorizationCode");
    expect(credential.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(test.request().codeChallenge).toBe(createHash("sha256").update(credential.nonce).digest("base64url"));
    expect(test.request().nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(test.request().state).toMatch(/^[0-9a-f]{64}$/);
    expect(test.request().state).not.toBe(credential.nonce);
    expect(test.post).toHaveBeenCalledWith("/api/auth/apple/browser", expect.objectContaining({ redirectUri: "cherry://auth/apple" }));
    expect(test.request()).not.toHaveProperty("verifier");
    expect(test.openAuthSessionAsync).toHaveBeenCalledWith(expect.stringContaining("https://appleid.apple.com/auth/authorize?"), "cherry://auth/apple");
  });

  it("uses the existing Apple provider and backend session pipeline", async () => {
    const test = setup();
    const provider = createAppleProvider({ signIn: test.adapter.signIn,
      getDevice: async () => ({ platform: "android", installationId: "synthetic", deviceName: "Synthetic" }) });
    const result = await provider.authenticate();
    expect(result.provider).toBe("apple");
    expect(result.payload.providerToken).toBe(`apple-browser:${grant}`);
    expect(result.payload.device.platform).toBe("android");
    expect(JSON.stringify(result.payload)).not.toContain("idToken");
  });

  it.each(["cancel", "dismiss"])("treats browser %s as a silent user cancellation", async (type) => {
    const test = setup({ result: () => ({ type }) });
    await expect(test.adapter.signIn()).rejects.toMatchObject({ code: "ERR_REQUEST_CANCELED" });
  });

  it.each([
    (state: string) => `https://evil.example/auth/apple?code=${grant}&state=${state}`,
    (state: string) => `cherry://auth/apple.evil?code=${grant}&state=${state}`,
    (state: string) => `cherry://user@auth/apple?code=${grant}&state=${state}`,
    () => `cherry://auth/apple?code=${grant}&state=wrong`,
    (state: string) => `cherry://auth/apple?code=${grant}&state=${state}&state=${state}`,
    (state: string) => `cherry://auth/apple?code=${grant}&code=${grant}&state=${state}`,
    (state: string) => `cherry://auth/apple?code=short&state=${state}`,
    (state: string) => `cherry://auth/apple?code=${grant}&state=${state}#token=not-allowed`,
    (state: string) => `cherry://auth/apple?code=${grant}&state=${state}&id_token=not-allowed`
  ])("rejects unexpected return URL/state/credentials", async (url) => {
    const test = setup({ result: (state) => ({ type: "success", url: url(state) }) });
    await expect(test.adapter.signIn()).rejects.toThrow("Invalid Apple app return");
  });

  it.each([
    "https://evil.example/auth/authorize", "http://appleid.apple.com/auth/authorize",
    "https://appleid.apple.com.evil.example/auth/authorize", "https://appleid.apple.com/auth/other"
  ])("never opens an untrusted authorization URL: %s", async (url) => {
    const test = setup({ authorization: (nonce) => `${url}?response_type=code&nonce=${nonce}` });
    await expect(test.adapter.signIn()).rejects.toThrow("Invalid Apple authorization URL");
    expect(test.openAuthSessionAsync).not.toHaveBeenCalled();
  });

  it("rejects provider errors without leaking them in error messages", async () => {
    const test = setup({ result: (state) => ({ type: "success", url: `cherry://auth/apple?state=${state}&error=secret-provider-detail` }) });
    await expect(test.adapter.signIn()).rejects.toThrow("Apple Sign-In failed. Please try again.");
  });

  it("requires a native custom scheme before contacting the backend", async () => {
    const test = setup({ scheme: "https" });
    await expect(test.adapter.signIn()).rejects.toThrow("scheme is not configured");
    expect(test.post).not.toHaveBeenCalled();
  });

  it("does not enable Android until the build flag is set, and leaves web disabled", () => {
    expect(defaultAppleAvailability("ios", false)).toBe("enabled");
    expect(defaultAppleAvailability("android", false)).toBe("soon");
    expect(defaultAppleAvailability("android", true)).toBe("enabled");
    expect(defaultAppleAvailability("web", true)).toBe("soon");
  });
});
