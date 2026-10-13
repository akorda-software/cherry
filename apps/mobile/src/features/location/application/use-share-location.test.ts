import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { LocationService } from "./share-location";
import { useShareLocation } from "./use-share-location";

const FIX = { latitude: 40.4, longitude: -3.7, accuracyMeters: 20, timestamp: Date.UTC(2026, 8, 29) };

function service(overrides: Partial<LocationService> = {}): LocationService {
  return {
    getPermission: vi.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
    getCurrentFix: vi.fn(async () => FIX),
    openSettings: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("useShareLocation", () => {
  it("goes idle → working → saved", async () => {
    const send = vi.fn(async () => undefined);
    const { result } = renderHook(() => useShareLocation({ service: service(), send }));
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.share();
    });

    expect(result.current.status).toBe("saved");
    expect(send).toHaveBeenCalledOnce();
  });

  it("explains a permanent denial and retries by itself when coming back from Settings", async () => {
    let foreground: () => void = () => undefined;
    const permissions = [
      { granted: false, canAskAgain: false },
      { granted: true, canAskAgain: true },
      { granted: true, canAskAgain: true }
    ];
    const svc = service({ getPermission: vi.fn(async () => permissions.shift() ?? { granted: true, canAskAgain: true }) });
    const send = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useShareLocation({
        service: svc,
        send,
        subscribeToForeground: (listener) => {
          foreground = listener;
          return () => undefined;
        }
      })
    );

    await act(async () => {
      await result.current.share();
    });
    expect(result.current.status).toBe("blocked");
    expect(result.current.message).toMatch(/Ajustes/);

    await act(async () => {
      await result.current.openSettings();
    });
    expect(svc.openSettings).toHaveBeenCalledOnce();

    act(() => foreground());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(send).toHaveBeenCalledOnce();
  });

  it("does not run twice when tapped twice", async () => {
    const send = vi.fn(async () => undefined);
    const { result } = renderHook(() => useShareLocation({ service: service(), send }));
    await act(async () => {
      await Promise.all([result.current.share(), result.current.share()]);
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it("offers a retry on API errors", async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { status: 500 });
    });
    const { result } = renderHook(() => useShareLocation({ service: service(), send }));
    await act(async () => {
      await result.current.share();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.message).toMatch(/por nuestra parte/);
  });
});
