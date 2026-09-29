import { describe, expect, it, vi } from "vitest";

import type { DiscoveryPreferences } from "@snack/contracts";

import {
  DEFAULT_FILTERS,
  filtersFromPreferences,
  preferencesFromFilters,
  snapDistance,
  toggleInterestedIn,
  UNLIMITED_DISTANCE_KM,
  validateFilters
} from "../domain/filters";
import { createDiscoveryPreferencesStore, type DiscoveryPreferencesDeps } from "./discovery-preferences";

function prefs(overrides: Partial<DiscoveryPreferences> = {}): DiscoveryPreferences {
  return {
    ageMin: 25,
    ageMax: 40,
    distanceKm: 50,
    showMen: true,
    showWomen: false,
    showNonBinary: true,
    compatibleOnly: false,
    expandDistance: true,
    discoveryMode: "feed",
    ...overrides
  };
}

describe("filters mapping", () => {
  it("maps preferences to filters and back", () => {
    const filters = filtersFromPreferences(prefs());

    expect(filters).toEqual({
      ageMin: 25,
      ageMax: 40,
      distanceKm: 50,
      interestedIn: ["man", "non_binary"],
      expandDistance: true,
      compatibleOnly: false
    });
    expect(preferencesFromFilters(filters)).toEqual({
      ageMin: 25,
      ageMax: 40,
      distanceKm: 50,
      showMen: true,
      showWomen: false,
      showNonBinary: true,
      expandDistance: true,
      compatibleOnly: false
    });
  });

  it("clamps ages to 18–99 and snaps odd distances", () => {
    const filters = filtersFromPreferences(prefs({ ageMin: 16, ageMax: 100, distanceKm: 30 }));

    expect(filters.ageMin).toBe(18);
    expect(filters.ageMax).toBe(99);
    expect(filters.distanceKm).toBe(25);
    expect(snapDistance(250)).toBe(UNLIMITED_DISTANCE_KM);
    expect(snapDistance(null)).toBe(DEFAULT_FILTERS.distanceKm);
  });

  it("uses safe defaults without preferences", () => {
    expect(filtersFromPreferences(null)).toEqual(DEFAULT_FILTERS);
  });

  it("validates at least one person type and a sane age range", () => {
    expect(validateFilters({ ...DEFAULT_FILTERS, interestedIn: [] })).toEqual(["interested_in_empty"]);
    expect(validateFilters({ ...DEFAULT_FILTERS, ageMin: 40, ageMax: 30 })).toEqual(["age_range"]);
    expect(validateFilters(DEFAULT_FILTERS)).toEqual([]);
  });

  it("never lets the interested-in selection become empty and keeps a stable order", () => {
    expect(toggleInterestedIn(["man"], "man")).toEqual(["man"]);
    expect(toggleInterestedIn(["non_binary"], "woman")).toEqual(["woman", "non_binary"]);
    expect(toggleInterestedIn(["woman", "man"], "woman")).toEqual(["man"]);
  });
});

describe("discovery preferences store", () => {
  function setup(overrides: Partial<DiscoveryPreferencesDeps> = {}) {
    const deps: DiscoveryPreferencesDeps = {
      get: vi.fn(async () => prefs()),
      update: vi.fn(async (fields) => prefs(fields)),
      ...overrides
    };
    return { deps, store: createDiscoveryPreferencesStore(deps) };
  }

  it("starts in swipe mode and adopts the stored mode", async () => {
    const { store } = setup();

    expect(store.getState().mode).toBe("swipe");
    await store.getState().load();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().mode).toBe("feed");
  });

  it("switches mode instantly and persists it", async () => {
    const { store, deps } = setup();
    await store.getState().load();

    const saving = store.getState().setMode("swipe");
    expect(store.getState().mode).toBe("swipe");
    await saving;

    expect(deps.update).toHaveBeenCalledWith({ discoveryMode: "swipe" });
    expect(store.getState().modeError).toBeNull();
  });

  it("keeps the chosen mode but tells the person when it could not be saved", async () => {
    const { store } = setup({
      update: vi.fn(async () => {
        throw new TypeError("offline");
      })
    });
    await store.getState().load();

    await store.getState().setMode("swipe");

    expect(store.getState().mode).toBe("swipe");
    expect(store.getState().modeError).toMatch(/conexión/);
  });

  it("saves changed filters and reports whether anything changed", async () => {
    const { store, deps } = setup();
    await store.getState().load();

    await expect(store.getState().saveFilters(store.getState().filters())).resolves.toEqual({
      ok: true,
      changed: false
    });
    expect(deps.update).not.toHaveBeenCalled();

    const next = { ...store.getState().filters(), distanceKm: 10 as const, compatibleOnly: true };
    await expect(store.getState().saveFilters(next)).resolves.toEqual({ ok: true, changed: true });
    expect(deps.update).toHaveBeenCalledWith(expect.objectContaining({ distanceKm: 10, compatibleOnly: true }));
    expect(store.getState().preferences?.distanceKm).toBe(10);
  });

  it("refuses invalid filters with a clear message", async () => {
    const { store, deps } = setup();
    await store.getState().load();

    const result = await store.getState().saveFilters({ ...store.getState().filters(), interestedIn: [] });

    expect(result).toEqual({ ok: false, message: expect.stringMatching(/al menos/) });
    expect(deps.update).not.toHaveBeenCalled();
  });
});
