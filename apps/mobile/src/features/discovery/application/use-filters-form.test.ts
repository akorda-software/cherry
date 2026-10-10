import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DiscoveryPreferences } from "@cherry/contracts";

import { createDiscoveryPreferencesStore } from "./discovery-preferences";
import { createDiscoveryQueue } from "./discovery-queue";
import { useFiltersForm } from "./use-filters-form";

function prefs(overrides: Partial<DiscoveryPreferences> = {}): DiscoveryPreferences {
  return {
    ageMin: 25,
    ageMax: 40,
    distanceKm: 50,
    showMen: false,
    showWomen: true,
    showNonBinary: false,
    compatibleOnly: false,
    expandDistance: true,
    discoveryMode: "swipe",
    ...overrides
  };
}

function setup() {
  const update = vi.fn(async (fields: Partial<DiscoveryPreferences>) => prefs(fields));
  const preferences = createDiscoveryPreferencesStore({ get: vi.fn(async () => prefs()), update });
  const fetchPage = vi.fn(async () => ({ profiles: [], nextCursor: null }));
  const queue = createDiscoveryQueue({ fetchPage, recordAction: vi.fn(), undo: vi.fn() });
  return { preferences, queue, update, fetchPage };
}

describe("useFiltersForm", () => {
  it("loads stored preferences into the draft", async () => {
    const deps = setup();
    const { result } = renderHook(() => useFiltersForm(deps));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.draft).toMatchObject({ ageMin: 25, ageMax: 40, interestedIn: ["woman"] });
    expect(result.current.dirty).toBe(false);
  });

  it("never lets the last person type be unselected", async () => {
    const deps = setup();
    const { result } = renderHook(() => useFiltersForm(deps));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.toggleInterestedIn("woman"));

    expect(result.current.draft.interestedIn).toEqual(["woman"]);
  });

  it("saves changes and reloads Descubrir", async () => {
    const deps = setup();
    const { result } = renderHook(() => useFiltersForm(deps));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.setDistance(10);
      result.current.setAgeRange(30, 22);
      result.current.setCompatibleOnly(true);
    });
    expect(result.current.dirty).toBe(true);
    expect(result.current.draft).toMatchObject({ ageMin: 22, ageMax: 30 });

    let closed = false;
    await act(async () => {
      closed = await result.current.save();
    });

    expect(closed).toBe(true);
    expect(deps.update).toHaveBeenCalledWith(expect.objectContaining({ distanceKm: 10, ageMin: 22, compatibleOnly: true }));
    expect(deps.fetchPage).toHaveBeenCalledWith(null);
  });

  it("closes without saving or reloading when nothing changed", async () => {
    const deps = setup();
    const { result } = renderHook(() => useFiltersForm(deps));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let closed = false;
    await act(async () => {
      closed = await result.current.save();
    });

    expect(closed).toBe(true);
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.fetchPage).not.toHaveBeenCalled();
  });
});
