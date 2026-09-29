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

describe("createSessionManager · refrescos concurrentes", () => {
  function setupConcurrent() {
    let stored: SessionBundle = expiredSession;
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return refreshedSession;
    });
    const manager = createSessionManager({
      storage: {
        read: async () => stored,
        write: async (session) => {
          stored = session;
        },
        clear: async () => undefined
      },
      sessionApi: { refresh, revoke: vi.fn(async () => undefined) },
      navigation: { goToSignedOut: vi.fn() },
      now: () => new Date("2026-04-12T21:00:00Z")
    });
    const request = vi.fn(async (token: string) => {
      if (token === "expired-access") {
        throw { status: 401 };
      }
      return token;
    });
    return { manager, refresh, request };
  }

  it("shares a single refresh between simultaneous 401s (reusing a refresh token revokes the session)", async () => {
    const { manager, refresh, request } = setupConcurrent();

    const results = await Promise.all([
      manager.executeWithRefresh(request),
      manager.executeWithRefresh(request),
      manager.executeWithRefresh(request)
    ]);

    expect(results).toEqual(["fresh-access", "fresh-access", "fresh-access"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("retries with the already-rotated session instead of refreshing again", async () => {
    const { manager, refresh, request } = setupConcurrent();
    let releaseSlow!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    // Sale con el token viejo y su 401 llega cuando otra petición ya ha refrescado.
    const slow = vi.fn(async (token: string) => {
      if (token === "expired-access") {
        await gate;
        throw { status: 401 };
      }
      return token;
    });

    const pendingSlow = manager.executeWithRefresh(slow);
    await expect(manager.executeWithRefresh(request)).resolves.toBe("fresh-access");
    releaseSlow();

    await expect(pendingSlow).resolves.toBe("fresh-access");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe("createSessionManager · fallos del refresco", () => {
  function setup(refresh: () => Promise<SessionBundle>, initial: SessionBundle | null = expiredSession) {
    let stored: SessionBundle | null = initial;
    const storage = {
      read: vi.fn(async () => stored),
      write: vi.fn(async (session: SessionBundle) => {
        stored = session;
      }),
      clear: vi.fn(async () => {
        stored = null;
      })
    };
    const navigation = { goToSignedOut: vi.fn() };
    const manager = createSessionManager({
      storage,
      sessionApi: { refresh: vi.fn(refresh), revoke: vi.fn(async () => undefined) },
      navigation,
      now: () => new Date("2026-04-12T21:00:00Z")
    });
    return {
      manager,
      storage,
      navigation,
      getStored: () => stored,
      setStored: (session: SessionBundle | null) => {
        stored = session;
      }
    };
  }

  const unauthorizedOnExpired = async (token: string) => {
    if (token === "expired-access") {
      throw { status: 401 };
    }
    return token;
  };

  it("keeps the stored session when refreshing fails for lack of network", async () => {
    const { manager, storage, navigation } = setup(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(manager.executeWithRefresh(unauthorizedOnExpired)).rejects.toBeInstanceOf(TypeError);
    expect(storage.clear).not.toHaveBeenCalled();
    expect(navigation.goToSignedOut).not.toHaveBeenCalled();
  });

  it("signs out for real when the server rejects the refresh token", async () => {
    const { manager, navigation, getStored } = setup(async () => {
      throw Object.assign(new Error("session_revoked"), { status: 401, code: "session_revoked" });
    });

    await expect(manager.executeWithRefresh(unauthorizedOnExpired)).rejects.toThrow("session_refresh_failed");
    expect(getStored()).toBeNull();
    expect(navigation.goToSignedOut).toHaveBeenCalledTimes(1);
  });

  it("opens with the stored session on a cold start without network", async () => {
    const { manager, storage } = setup(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(manager.bootstrap()).resolves.toEqual(expiredSession);
    expect(storage.clear).not.toHaveBeenCalled();
  });

  it("drops the session on a cold start when the server rejects it", async () => {
    const { manager, getStored } = setup(async () => {
      throw Object.assign(new Error("invalid_refresh_token"), { status: 401 });
    });

    await expect(manager.bootstrap()).resolves.toBeNull();
    expect(getStored()).toBeNull();
  });
});

describe("createSessionManager · cambio de sesión durante un reintento", () => {
  const otherUser: SessionBundle = {
    ...refreshedSession,
    accessToken: "other-access",
    refreshToken: "other-refresh",
    user: { id: "user-2", email: "b@example.com", displayName: "B" }
  };

  function setupStore(initial: SessionBundle | null) {
    let stored = initial;
    return {
      storage: {
        read: vi.fn(async () => stored),
        write: vi.fn(async (session: SessionBundle) => {
          stored = session;
        }),
        clear: vi.fn(async () => {
          stored = null;
        })
      },
      set: (session: SessionBundle | null) => {
        stored = session;
      },
      get: () => stored
    };
  }

  it("never resurrects a signed-out session when the storage is empty", async () => {
    const store = setupStore(expiredSession);
    const refresh = vi.fn(async () => refreshedSession);
    const navigation = { goToSignedOut: vi.fn() };
    const manager = createSessionManager({
      storage: store.storage,
      sessionApi: { refresh, revoke: vi.fn(async () => undefined) },
      navigation
    });
    const request = vi.fn(async () => {
      store.set(null); // se cerró sesión mientras volaba
      throw { status: 401 };
    });

    await expect(manager.executeWithRefresh(request)).rejects.toThrow("missing_session");
    expect(refresh).not.toHaveBeenCalled();
    expect(store.get()).toBeNull();
    expect(navigation.goToSignedOut).toHaveBeenCalled();
  });

  it("does not retry with another person's token", async () => {
    const store = setupStore(expiredSession);
    const manager = createSessionManager({
      storage: store.storage,
      sessionApi: { refresh: vi.fn(async () => refreshedSession), revoke: vi.fn(async () => undefined) },
      navigation: { goToSignedOut: vi.fn() }
    });
    const request = vi.fn(async (token: string) => {
      if (token === "expired-access") {
        store.set(otherUser); // entró otra cuenta mientras volaba
        throw { status: 401 };
      }
      return token;
    });

    await expect(manager.executeWithRefresh(request)).rejects.toThrow("session_changed");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("a sign-out invalidates a refresh in flight: the rotated session is not written back", async () => {
    const store = setupStore(expiredSession);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refresh = vi.fn(async () => {
      await gate;
      return refreshedSession;
    });
    const manager = createSessionManager({
      storage: store.storage,
      sessionApi: { refresh, revoke: vi.fn(async () => undefined) },
      navigation: { goToSignedOut: vi.fn() }
    });
    const request = vi.fn(async (token: string) => {
      if (token === "expired-access") {
        throw { status: 401 };
      }
      return token;
    });

    const pending = manager.executeWithRefresh(request);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    manager.invalidate();
    store.set(null);
    release();

    await expect(pending).rejects.toThrow();
    expect(store.storage.write).not.toHaveBeenCalled();
    expect(store.get()).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
