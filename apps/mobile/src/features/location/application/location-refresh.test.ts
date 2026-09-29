import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCATION_REFRESH_INTERVAL_MS,
  markLocationShared,
  refreshLocationSilently,
  resetLocationRefresh,
  type LocationRefreshOptions
} from "./location-refresh";
import type { LocationService } from "./share-location";

const FIX = { latitude: 41.3874, longitude: 2.1686, accuracyMeters: 42.4, timestamp: Date.UTC(2026, 8, 29, 9, 0, 0) };

function fakeService(overrides: Partial<LocationService> = {}) {
  return {
    getPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
    requestPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
    getCurrentFix: vi.fn(async () => FIX),
    openSettings: vi.fn(async () => undefined),
    ...overrides
  };
}

function options(overrides: Partial<LocationRefreshOptions> & { service?: LocationService } = {}) {
  const service = overrides.service ?? fakeService();
  const send = vi.fn(async () => undefined);
  let clock = Date.UTC(2026, 8, 29, 10, 0, 0);
  const opts = { service, send, now: () => clock, ...overrides };
  return {
    opts,
    service,
    send: opts.send,
    advance(ms: number) {
      clock += ms;
    }
  };
}

describe("refreshLocationSilently", () => {
  afterEach(() => {
    resetLocationRefresh();
  });

  it("sends the rounded position when permission is already granted", async () => {
    const { opts, send, service } = options();

    await expect(refreshLocationSilently(opts)).resolves.toBe("sent");
    expect(send).toHaveBeenCalledWith({
      latitude: 41.3874,
      longitude: 2.1686,
      accuracyMeters: 42,
      recordedAt: "2026-09-29T09:00:00.000Z"
    });
    expect(service.requestPermission).not.toHaveBeenCalled();
  });

  it("never asks for permission and sends nothing without it", async () => {
    const service = fakeService({ getPermission: vi.fn(async () => ({ granted: false, canAskAgain: true })) });
    const { opts, send } = options({ service });

    await expect(refreshLocationSilently(opts)).resolves.toBe("no_permission");
    expect(service.requestPermission).not.toHaveBeenCalled();
    expect(service.getCurrentFix).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends at most once every 30 minutes", async () => {
    const { opts, send, advance } = options();

    await expect(refreshLocationSilently(opts)).resolves.toBe("sent");
    advance(LOCATION_REFRESH_INTERVAL_MS - 1);
    await expect(refreshLocationSilently(opts)).resolves.toBe("throttled");
    expect(send).toHaveBeenCalledOnce();

    advance(1);
    await expect(refreshLocationSilently(opts)).resolves.toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("counts a manual update (Settings) towards the throttle", async () => {
    const { opts, send } = options();
    markLocationShared(opts.now());

    await expect(refreshLocationSilently(opts)).resolves.toBe("throttled");
    expect(send).not.toHaveBeenCalled();
  });

  it("joins a refresh already in flight instead of sending twice", async () => {
    const { opts, send } = options();

    const [first, second] = await Promise.all([refreshLocationSilently(opts), refreshLocationSilently(opts)]);
    expect([first, second]).toEqual(["sent", "in_flight"]);
    expect(send).toHaveBeenCalledOnce();
  });

  it("stays silent on failures and retries on the next opportunity", async () => {
    const send = vi
      .fn<(request: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue(undefined);
    const { opts } = options({ send });

    await expect(refreshLocationSilently(opts)).resolves.toBe("failed");
    await expect(refreshLocationSilently(opts)).resolves.toBe("sent");

    const unavailable = options({ service: fakeService({ getCurrentFix: vi.fn(async () => null) }) });
    await expect(refreshLocationSilently({ ...unavailable.opts, now: () => opts.now() + LOCATION_REFRESH_INTERVAL_MS })).resolves.toBe(
      "unavailable"
    );
    expect(unavailable.send).not.toHaveBeenCalled();

    const throwing = options({
      service: fakeService({
        getPermission: vi.fn(async () => {
          throw new Error("web: permissions API missing");
        })
      })
    });
    await expect(refreshLocationSilently({ ...throwing.opts, now: () => opts.now() + LOCATION_REFRESH_INTERVAL_MS })).resolves.toBe(
      "no_permission"
    );
  });

  it("sends nothing once the session is gone", async () => {
    const { opts, send } = options({ isSessionActive: () => false });
    await expect(refreshLocationSilently(opts)).resolves.toBe("cancelled");
    expect(send).not.toHaveBeenCalled();
  });

  it("drops a refresh started before sign-out", async () => {
    let releaseFix: (fix: typeof FIX) => void = () => undefined;
    const service = fakeService({ getCurrentFix: vi.fn(() => new Promise<typeof FIX>((resolve) => (releaseFix = resolve))) });
    const { opts, send } = options({ service });

    const pending = refreshLocationSilently(opts);
    await vi.waitFor(() => expect(service.getCurrentFix).toHaveBeenCalled());
    resetLocationRefresh();
    releaseFix(FIX);

    await expect(pending).resolves.toBe("cancelled");
    expect(send).not.toHaveBeenCalled();
  });
});
