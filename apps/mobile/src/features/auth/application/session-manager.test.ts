import { describe, expect, it, vi } from "vitest";

import type { SessionBundle } from "@snack/contracts";
import { createSessionManager } from "./session-manager";

const expiredSession: SessionBundle = {
  accessToken: "expired-access",
  accessTokenExpiresAt: "2026-04-12T20:59:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

const refreshedSession: SessionBundle = {
  accessToken: "fresh-access",
  accessTokenExpiresAt: "2026-04-12T21:10:00Z",
  refreshToken: "fresh-refresh",
  refreshTokenExpiresAt: "2026-04-19T21:10:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

describe("createSessionManager", () => {
  it("refreshes an expired cached session during bootstrap recovery", async () => {
    const write = vi.fn(async () => undefined);
    const manager = createSessionManager({
      storage: {
        read: async () => expiredSession,
        write,
        clear: async () => undefined
      },
      sessionApi: {
        refresh: vi.fn(async () => refreshedSession),
        revoke: vi.fn(async () => undefined)
      },
      navigation: {
        goToSignedOut: vi.fn()
      },
      now: () => new Date("2026-04-12T21:00:00Z")
    });

    await expect(manager.bootstrap()).resolves.toEqual(refreshedSession);
    expect(write).toHaveBeenCalledWith(refreshedSession);
  });

  it("refreshes once after a 401 and retries the protected request with the rotated access token", async () => {
    const write = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    const performRequest = vi
      .fn<(accessToken: string) => Promise<string>>()
      .mockRejectedValueOnce({ status: 401 })
      .mockResolvedValueOnce("ok");

    const manager = createSessionManager({
      storage: {
        read: async () => expiredSession,
        write,
        clear
      },
      sessionApi: {
        refresh: vi.fn(async () => refreshedSession),
        revoke: vi.fn(async () => undefined)
      },
      navigation: {
        goToSignedOut: vi.fn()
      },
      now: () => new Date("2026-04-12T21:00:00Z")
    });

    await expect(manager.executeWithRefresh(performRequest)).resolves.toBe("ok");

    expect(performRequest).toHaveBeenNthCalledWith(1, "expired-access");
    expect(performRequest).toHaveBeenNthCalledWith(2, "fresh-access");
    expect(write).toHaveBeenCalledWith(refreshedSession);
    expect(clear).not.toHaveBeenCalled();
  });
});
