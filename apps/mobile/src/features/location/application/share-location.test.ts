import { describe, expect, it, vi } from "vitest";

import { shareLocation, toLocationUpdateRequest, type LocationService } from "./share-location";

const FIX = { latitude: 40.4168, longitude: -3.7038, accuracyMeters: 35.7, timestamp: Date.UTC(2026, 8, 29, 12, 0, 0) };

function fakeService(overrides: Partial<LocationService> = {}): LocationService {
  return {
    getPermission: vi.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })),
    getCurrentFix: vi.fn(async () => FIX),
    openSettings: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("toLocationUpdateRequest", () => {
  it("rounds the accuracy (backend stores an integer) and sends an ISO timestamp", () => {
    expect(toLocationUpdateRequest(FIX)).toEqual({
      latitude: 40.4168,
      longitude: -3.7038,
      accuracyMeters: 36,
      recordedAt: "2026-09-29T12:00:00.000Z"
    });
  });

  it("omits a missing accuracy", () => {
    expect(toLocationUpdateRequest({ ...FIX, accuracyMeters: null })).not.toHaveProperty("accuracyMeters");
  });
});

describe("shareLocation", () => {
  it("asks for permission, reads the position and sends it", async () => {
    const service = fakeService();
    const send = vi.fn(async () => undefined);

    await expect(shareLocation(service, send)).resolves.toEqual({ status: "saved" });
    expect(service.requestPermission).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ latitude: 40.4168, longitude: -3.7038, accuracyMeters: 36 }));
  });

  it("does not ask again when permission is already granted", async () => {
    const service = fakeService({ getPermission: vi.fn(async () => ({ granted: true, canAskAgain: true })) });
    await shareLocation(service, vi.fn(async () => undefined));
    expect(service.requestPermission).not.toHaveBeenCalled();
  });

  it("reports a denial and whether the system can still ask", async () => {
    const soft = fakeService({ requestPermission: vi.fn(async () => ({ granted: false, canAskAgain: true })) });
    await expect(shareLocation(soft, vi.fn())).resolves.toEqual({ status: "denied", canAskAgain: true });

    const hard = fakeService({ getPermission: vi.fn(async () => ({ granted: false, canAskAgain: false })) });
    await expect(shareLocation(hard, vi.fn())).resolves.toEqual({ status: "denied", canAskAgain: false });
    expect(hard.requestPermission).not.toHaveBeenCalled();
  });

  it("reports unavailable when there is no fix (GPS off, timeout, bad data)", async () => {
    const send = vi.fn();
    await expect(shareLocation(fakeService({ getCurrentFix: vi.fn(async () => null) }), send)).resolves.toEqual({
      status: "unavailable"
    });
    await expect(
      shareLocation(
        fakeService({
          getCurrentFix: vi.fn(async () => {
            throw new Error("timeout");
          })
        }),
        send
      )
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      shareLocation(fakeService({ getCurrentFix: vi.fn(async () => ({ ...FIX, latitude: 123 })) }), send)
    ).resolves.toEqual({ status: "unavailable" });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns the API error so the UI can offer a retry", async () => {
    const failure = new TypeError("Network request failed");
    await expect(
      shareLocation(
        fakeService(),
        vi.fn(async () => {
          throw failure;
        })
      )
    ).resolves.toEqual({ status: "error", error: failure });
  });
});
