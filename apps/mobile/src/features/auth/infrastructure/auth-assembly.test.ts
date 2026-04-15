import { describe, expect, it, vi } from "vitest";

import type { SessionShellServices } from "../presentation";
import { assembleAuthServices } from "./auth-assembly";

function createTestDeps() {
  const storage = {
    read: vi.fn(async () => null),
    write: vi.fn(async () => {}),
    clear: vi.fn(async () => {})
  };

  const authApi = {
    completeCallback: vi.fn(async () => ({
      accessToken: "access-token",
      accessTokenExpiresAt: "2026-12-31T23:59:59Z",
      refreshToken: "refresh-token",
      refreshTokenExpiresAt: "2027-01-31T23:59:59Z",
      user: { id: "user-1", email: "test@example.com", displayName: "Test User" }
    }))
  };

  const sessionApi = {
    refresh: vi.fn(),
    revoke: vi.fn(async () => {})
  };

  const device = {
    getDevice: vi.fn(async () => ({
      installationId: "install-1",
      platform: "android" as const,
      deviceName: "Test Device"
    }))
  };

  const nativeGoogle = {
    signIn: vi.fn(async () => ({ providerToken: "google-token" }))
  };

  const nativeApple = {
    signIn: vi.fn(async () => ({
      providerToken: "apple-token",
      authorizationCode: "auth-code",
      idToken: "id-token",
      nonce: "nonce"
    }))
  };

  const navigation = { goToSignedOut: vi.fn() };

  return {
    deps: {
      googleWebClientId: "web-client-id",
      storage,
      authApi,
      sessionApi,
      device,
      nativeGoogle,
      nativeApple,
      navigation
    },
    spies: { storage, authApi, sessionApi, device, nativeGoogle, nativeApple, navigation }
  };
}

describe("assembleAuthServices", () => {
  it("returns a complete SessionShellServices object", () => {
    const { deps } = createTestDeps();
    const services = assembleAuthServices(deps);

    expect(services).toHaveProperty("bootstrapSession");
    expect(services).toHaveProperty("authProviders.google");
    expect(services).toHaveProperty("authProviders.apple");
    expect(services).toHaveProperty("completeAuth.google");
    expect(services).toHaveProperty("completeAuth.apple");
    expect(services).toHaveProperty("logoutSession");
  });

  it("Google authenticate calls native signIn and device concurrently", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    const result = await services.authProviders.google.authenticate();

    expect(result.provider).toBe("google");
    expect(result.payload.providerToken).toBe("google-token");
    expect(result.payload.device).toEqual({
      installationId: "install-1",
      platform: "android",
      deviceName: "Test Device"
    });
    expect(spies.nativeGoogle.signIn).toHaveBeenCalled();
    expect(spies.device.getDevice).toHaveBeenCalled();
  });

  it("Apple authenticate returns all required fields", async () => {
    const { deps } = createTestDeps();
    const services = assembleAuthServices(deps);

    const result = await services.authProviders.apple.authenticate();

    expect(result.provider).toBe("apple");
    expect(result.payload.providerToken).toBe("apple-token");
    expect(result.payload.authorizationCode).toBe("auth-code");
    expect(result.payload.idToken).toBe("id-token");
    expect(result.payload.nonce).toBe("nonce");
  });

  it("completeAuth.google calls API and persists session", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    const payload = { providerToken: "token", device: { installationId: "1", platform: "android" as const, deviceName: "D" } };
    const session = await services.completeAuth.google.execute(payload);

    expect(spies.authApi.completeCallback).toHaveBeenCalledWith("google", payload);
    expect(spies.storage.write).toHaveBeenCalledWith(session);
  });

  it("completeAuth.apple calls API and persists session", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    const payload = {
      providerToken: "apple-token",
      authorizationCode: "code",
      idToken: "id",
      nonce: "n",
      device: { installationId: "1", platform: "ios" as const, deviceName: "iPhone" }
    };
    const session = await services.completeAuth.apple.execute(payload);

    expect(spies.authApi.completeCallback).toHaveBeenCalledWith("apple", payload);
    expect(spies.storage.write).toHaveBeenCalledWith(session);
  });

  it("bootstrapSession reads from storage", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    await services.bootstrapSession.execute();

    expect(spies.storage.read).toHaveBeenCalled();
  });

  it("logoutSession clears storage and revokes token when session exists", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    const session = {
      accessToken: "at",
      accessTokenExpiresAt: "2026-12-31T23:59:59Z",
      refreshToken: "rt",
      refreshTokenExpiresAt: "2027-01-31T23:59:59Z",
      user: { id: "u1", email: "e@e.com", displayName: "U" }
    };

    await services.logoutSession.execute(session);

    expect(spies.storage.clear).toHaveBeenCalled();
    expect(spies.sessionApi.revoke).toHaveBeenCalledWith("rt");
  });

  it("logoutSession does not revoke when session is null", async () => {
    const { deps, spies } = createTestDeps();
    const services = assembleAuthServices(deps);

    await services.logoutSession.execute(null);

    expect(spies.storage.clear).toHaveBeenCalled();
    expect(spies.sessionApi.revoke).not.toHaveBeenCalled();
  });
});
