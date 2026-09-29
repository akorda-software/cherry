import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppBootstrap } from "../domain/bootstrap";
import { refreshBootstrap, useBootstrapStore } from "./bootstrap-store";

function bootstrapFor(isPaused: boolean): AppBootstrap {
  return {
    user: { id: "user-1", email: "demo@snack.dev", displayName: "Lucía" },
    profile: {
      exists: true,
      isComplete: true,
      isDiscoverable: !isPaused,
      isPaused,
      onboardingRequired: false,
      nextOnboardingStep: null
    }
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function configureWith(fetchBootstrap: () => Promise<AppBootstrap>) {
  useBootstrapStore.getState().configure({
    service: { fetchBootstrap },
    executeAuthenticated: (request) => request("token")
  });
}

describe("bootstrap store", () => {
  beforeEach(() => {
    useBootstrapStore.setState({
      status: "idle",
      bootstrap: null,
      error: null,
      service: null,
      executeAuthenticated: null,
      sessionStatus: null
    });
  });

  it("keeps the current bootstrap visible while it revalidates", async () => {
    const next = deferred<AppBootstrap>();
    let calls = 0;
    configureWith(() => (++calls === 1 ? Promise.resolve(bootstrapFor(false)) : next.promise));

    useBootstrapStore.getState().setSessionStatus("signed-in");
    await vi.waitFor(() => expect(useBootstrapStore.getState().status).toBe("ready"));

    const pending = refreshBootstrap();
    expect(useBootstrapStore.getState().status).toBe("ready");
    expect(useBootstrapStore.getState().bootstrap?.profile.isPaused).toBe(false);

    next.resolve(bootstrapFor(true));
    await pending;
    expect(useBootstrapStore.getState().bootstrap?.profile.isPaused).toBe(true);
  });

  it("keeps the previous bootstrap when a background refresh fails", async () => {
    let calls = 0;
    configureWith(() =>
      ++calls === 1 ? Promise.resolve(bootstrapFor(false)) : Promise.reject(new Error("offline"))
    );

    useBootstrapStore.getState().setSessionStatus("signed-in");
    await vi.waitFor(() => expect(useBootstrapStore.getState().status).toBe("ready"));
    await refreshBootstrap();

    expect(useBootstrapStore.getState().status).toBe("ready");
    expect(useBootstrapStore.getState().bootstrap?.profile.isPaused).toBe(false);
  });

  it("shows the loading state on the first load", () => {
    configureWith(() => new Promise(() => undefined));

    useBootstrapStore.getState().setSessionStatus("signed-in");

    expect(useBootstrapStore.getState().status).toBe("loading");
  });

  it("drops a response that arrives after signing out", async () => {
    const late = deferred<AppBootstrap>();
    configureWith(() => late.promise);

    useBootstrapStore.getState().setSessionStatus("signed-in");
    useBootstrapStore.getState().setSessionStatus("signed-out");
    late.resolve(bootstrapFor(false));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useBootstrapStore.getState().status).toBe("idle");
    expect(useBootstrapStore.getState().bootstrap).toBeNull();
  });
});
