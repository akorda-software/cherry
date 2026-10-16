import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionBundle } from "@cherry/contracts";

import { useSessionStore } from "./session-store";

const originalServices = useSessionStore.getState().services;
const session: SessionBundle = {
  accessToken: "test-access",
  accessTokenExpiresAt: "2026-10-15T00:00:00Z",
  refreshToken: "test-refresh",
  refreshTokenExpiresAt: "2026-10-20T00:00:00Z",
  user: { id: "user-A", displayName: "A", email: "a@example.test" }
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  useSessionStore.setState({
    status: "signed-in", session,
    services: { ...originalServices, executeAuthenticated: undefined }
  });
});
afterEach(() => useSessionStore.setState({ status: "signed-out", session: null, services: originalServices }));

describe("authenticated response ownership", () => {
  it("returns a successful response without changing the session", async () => {
    const request = vi.fn(async () => "ok");
    await expect(useSessionStore.getState().executeAuthenticated(request)).resolves.toBe("ok");
    expect(request).toHaveBeenCalledExactlyOnceWith("test-access");
  });

  it("rejects a successful response after switching directly to another account", async () => {
    const response = deferred<string>();
    const pending = useSessionStore.getState().executeAuthenticated(() => response.promise);
    useSessionStore.setState({ session: { ...session, user: { ...session.user, id: "user-B" } } });
    response.resolve("A's response");
    await expect(pending).rejects.toThrow("session_changed");
  });

  it("rejects a response even if the same account signs back in", async () => {
    const response = deferred<string>();
    const pending = useSessionStore.getState().executeAuthenticated(() => response.promise);
    useSessionStore.setState({ status: "signed-out", session: null });
    useSessionStore.setState({ status: "signed-in", session });
    response.resolve("old session");
    await expect(pending).rejects.toThrow("session_changed");
  });

  it("guards successful responses through the refresh service too", async () => {
    const response = deferred<string>();
    useSessionStore.setState({ services: {
      ...originalServices,
      executeAuthenticated: <T,>(request: (token: string) => Promise<T>) => request("rotated-token")
    } });
    const request = vi.fn(() => response.promise);
    const pending = useSessionStore.getState().executeAuthenticated(request);
    useSessionStore.setState({ status: "signed-out", session: null });
    response.resolve("old session");
    await expect(pending).rejects.toThrow("session_changed");
    expect(request).toHaveBeenCalledExactlyOnceWith("rotated-token");
  });

  it("does not send a request if the session changed while its service was preparing", async () => {
    const ready = deferred<void>();
    useSessionStore.setState({ services: {
      ...originalServices,
      executeAuthenticated: async <T,>(request: (token: string) => Promise<T>) => {
        await ready.promise;
        return request("new-account-token");
      }
    } });
    const request = vi.fn(async () => "ok");
    const pending = useSessionStore.getState().executeAuthenticated(request);
    useSessionStore.setState({ status: "signed-out", session: null });
    ready.resolve();
    await expect(pending).rejects.toThrow("session_changed");
    expect(request).not.toHaveBeenCalled();
  });

  it("accepts token rotation for the same account without treating it as a new session", async () => {
    const response = deferred<string>();
    const pending = useSessionStore.getState().executeAuthenticated(() => response.promise);
    useSessionStore.setState({ session: { ...session, accessToken: "rotated-token" } });
    response.resolve("ok");
    await expect(pending).resolves.toBe("ok");
  });
});
