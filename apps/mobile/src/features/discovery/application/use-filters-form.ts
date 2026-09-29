import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";

import type { Gender } from "@snack/contracts";

import {
  type DiscoveryFilters,
  type DistanceOption,
  filtersFromPreferences,
  sameFilters,
  toggleInterestedIn
} from "../domain/filters";
import type { DiscoveryPreferencesStore } from "./discovery-preferences";
import type { DiscoveryQueueStore } from "./discovery-queue";

export interface FiltersFormDeps {
  preferences: StoreApi<DiscoveryPreferencesStore>;
  queue: StoreApi<DiscoveryQueueStore>;
}

export interface FiltersForm {
  status: DiscoveryPreferencesStore["status"];
  draft: DiscoveryFilters;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  setAgeRange(min: number, max: number): void;
  setDistance(km: DistanceOption): void;
  toggleInterestedIn(value: Gender): void;
  setExpandDistance(value: boolean): void;
  setCompatibleOnly(value: boolean): void;
  retryLoad(): void;
  /** Guarda y recarga Descubrir si algo cambió. `true` = se puede cerrar. */
  save(): Promise<boolean>;
}

export function useFiltersForm({ preferences, queue }: FiltersFormDeps): FiltersForm {
  const status = useStore(preferences, (state) => state.status);
  const stored = useStore(preferences, (state) => state.preferences);
  const initial = useMemo(() => filtersFromPreferences(stored), [stored]);
  const [draft, setDraft] = useState<DiscoveryFilters>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (preferences.getState().status === "idle") {
      void preferences.getState().load();
    }
  }, [preferences]);

  // Cuando llegan las preferencias guardadas, el formulario las adopta (si no has tocado nada).
  useEffect(() => {
    if (!touched.current) {
      setDraft(initial);
    }
  }, [initial]);

  const update = useCallback((recipe: (current: DiscoveryFilters) => DiscoveryFilters) => {
    touched.current = true;
    setError(null);
    setDraft(recipe);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const result = await preferences.getState().saveFilters(draft);

      if (!result.ok) {
        setError(result.message);
        return false;
      }

      if (result.changed) {
        // Recarga ya: al volver a Descubrir, la pila refleja los filtros nuevos.
        void queue.getState().load();
      }

      touched.current = false;
      return true;
    } finally {
      setSaving(false);
    }
  }, [draft, preferences, queue]);

  return {
    status,
    draft,
    dirty: !sameFilters(draft, initial),
    saving,
    error,
    setAgeRange: (min, max) => update((current) => ({ ...current, ageMin: Math.min(min, max), ageMax: Math.max(min, max) })),
    setDistance: (km) => update((current) => ({ ...current, distanceKm: km })),
    toggleInterestedIn: (value) =>
      update((current) => ({ ...current, interestedIn: toggleInterestedIn(current.interestedIn, value) })),
    setExpandDistance: (value) => update((current) => ({ ...current, expandDistance: value })),
    setCompatibleOnly: (value) => update((current) => ({ ...current, compatibleOnly: value })),
    retryLoad: () => void preferences.getState().load(),
    save
  };
}
