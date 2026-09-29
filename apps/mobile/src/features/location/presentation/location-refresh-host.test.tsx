import * as Location from "expo-location";
import { AppState } from "react-native";
import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { useBootstrapStore } from "../../app-bootstrap/presentation/bootstrap-store";
import { LOCATION_REFRESH_INTERVAL_MS, resetLocationRefresh } from "../application/location-refresh";
import { LocationRefreshHost } from "./location-refresh-host";

const granted = { granted: true, canAskAgain: true, status: "granted", expires: "never" } as const;
const signedIn = { bootstrapSession: { execute: async () => sessionFixture } };

function grantPermission() {
  vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue(granted as never);
}

describe("LocationRefreshHost", () => {
  beforeEach(() => {
    resetLocationRefresh();
    // El bootstrap es un store global: que no arrastre el perfil completo del test anterior.
    useBootstrapStore.setState({ status: "idle", bootstrap: null, error: null, sessionStatus: null });
    vi.mocked(Location.getForegroundPermissionsAsync).mockClear();
    vi.mocked(Location.requestForegroundPermissionsAsync).mockClear();
  });

  afterEach(() => {
    vi.mocked(Location.getForegroundPermissionsAsync).mockReset();
    vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      granted: false,
      canAskAgain: true,
      status: "denied",
      expires: "never"
    } as never);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refreshes the location on mount when permission is already granted", async () => {
    grantPermission();
    const backend = stubBackend(() => ({ body: { ok: true } }));

    renderRoute(<LocationRefreshHost />, { services: signedIn });

    await waitFor(() => expect(backend.callsTo("/api/me/location", "POST")).toHaveLength(1));
    expect(backend.callsTo("/api/me/location", "POST")[0]?.body).toMatchObject({ latitude: 40.4168, longitude: -3.7038 });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("never asks for permission and sends nothing without it", async () => {
    const backend = stubBackend(() => ({ body: { ok: true } }));

    renderRoute(<LocationRefreshHost />, { services: signedIn });

    await waitFor(() => expect(Location.getForegroundPermissionsAsync).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(backend.callsTo("/api/me/location")).toHaveLength(0);
  });

  it("waits for a complete profile", async () => {
    grantPermission();
    const backend = stubBackend(() => ({ body: { ok: true } }));

    renderRoute(<LocationRefreshHost />, { services: signedIn, onboardingRequired: true });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(backend.callsTo("/api/me/location")).toHaveLength(0);
  });

  it("refreshes again when the app comes back to the foreground (throttled) and cleans up", async () => {
    grantPermission();
    const listeners: Array<(state: string) => void> = [];
    const remove = vi.fn();
    vi.spyOn(AppState, "addEventListener").mockImplementation(((_type: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove };
    }) as never);
    const backend = stubBackend(() => ({ body: { ok: true } }));
    let clock = Date.UTC(2026, 8, 29, 10, 0, 0);
    vi.spyOn(Date, "now").mockImplementation(() => clock);

    const { unmount } = renderRoute(<LocationRefreshHost />, { services: signedIn });
    await waitFor(() => expect(backend.callsTo("/api/me/location", "POST")).toHaveLength(1));

    // Vuelve enseguida: throttle.
    listeners.forEach((listener) => listener("active"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(backend.callsTo("/api/me/location", "POST")).toHaveLength(1);

    // Media hora después, sí.
    clock += LOCATION_REFRESH_INTERVAL_MS;
    listeners.forEach((listener) => listener("background"));
    listeners.forEach((listener) => listener("active"));
    await waitFor(() => expect(backend.callsTo("/api/me/location", "POST")).toHaveLength(2));

    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
