import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useProfilePauseController, type ProfilePauseDeps } from "./use-profile-pause-controller";

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

/** Simula el bootstrap: `refresh()` publica el valor del «servidor» antes de resolver. */
function setup(overrides: Partial<ProfilePauseDeps> = {}, serverAfterRefresh?: boolean) {
  const holder: { rerender?: (props: ProfilePauseDeps) => void } = {};
  const deps: ProfilePauseDeps = {
    isPaused: false,
    pause: vi.fn(async () => undefined),
    unpause: vi.fn(async () => undefined),
    refresh: vi.fn(async () => {
      if (serverAfterRefresh !== undefined) {
        holder.rerender?.({ ...deps, isPaused: serverAfterRefresh });
      }
    }),
    ...overrides
  };

  const hook = renderHook((props: ProfilePauseDeps) => useProfilePauseController(props), {
    initialProps: deps
  });
  holder.rerender = hook.rerender;

  return { deps, ...hook };
}

describe("useProfilePauseController", () => {
  it("shows the chosen value right away and then follows the refreshed bootstrap", async () => {
    const request = deferred();
    const { result, deps } = setup({ pause: vi.fn(() => request.promise) }, true);

    let outcome: Promise<boolean> | undefined;
    act(() => {
      outcome = result.current.setPaused(true);
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.pending).toBe(true);

    await act(async () => {
      request.resolve();
      await outcome;
    });

    expect(deps.pause).toHaveBeenCalledTimes(1);
    expect(deps.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(false);
    expect(result.current.isPaused).toBe(true);
  });

  it("keeps the saved value while the bootstrap still shows the old one", async () => {
    const { result } = setup({}, false);

    await act(async () => {
      await result.current.setPaused(true);
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("reverts and explains when the server rejects the change", async () => {
    const { result, deps } = setup({
      isPaused: true,
      unpause: vi.fn(async () => {
        throw Object.assign(new Error("boom"), { status: 500 });
      })
    });

    let accepted = true;
    await act(async () => {
      accepted = await result.current.setPaused(false);
    });

    expect(accepted).toBe(false);
    expect(result.current.isPaused).toBe(true);
    expect(result.current.error).toBe("Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar.");
    expect(deps.refresh).not.toHaveBeenCalled();
  });

  it("holds the saved value when the bootstrap refresh fails, until the source catches up", async () => {
    const { result, rerender, deps } = setup({
      refresh: vi.fn(async () => {
        throw new Error("offline");
      })
    });

    await act(async () => {
      await result.current.setPaused(true);
    });

    expect(result.current.isPaused).toBe(true);

    rerender({ ...deps, isPaused: true });
    expect(result.current.isPaused).toBe(true);

    rerender({ ...deps, isPaused: false });
    expect(result.current.isPaused).toBe(false);
  });

  it("ignores taps while a change is in flight", async () => {
    const request = deferred();
    const { result, deps } = setup({ pause: vi.fn(() => request.promise) });

    let second: boolean | undefined;
    await act(async () => {
      void result.current.setPaused(true);
      second = await result.current.setPaused(false);
    });

    expect(second).toBe(false);
    expect(deps.unpause).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve();
    });
  });
});
