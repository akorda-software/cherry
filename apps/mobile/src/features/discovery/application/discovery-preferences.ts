import { createStore, type StoreApi } from "zustand/vanilla";

import type { DiscoveryMode, DiscoveryPreferences } from "@snack/contracts";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  type DiscoveryFilters,
  filtersFromPreferences,
  preferencesFromFilters,
  validateFilters
} from "../domain/filters";

export interface DiscoveryPreferencesDeps {
  get(): Promise<DiscoveryPreferences>;
  update(fields: Partial<DiscoveryPreferences>): Promise<DiscoveryPreferences>;
}

export interface DiscoveryPreferencesState {
  status: "idle" | "loading" | "ready" | "error";
  preferences: DiscoveryPreferences | null;
  /** Modo que se pinta ahora mismo (cambia al instante; se guarda en segundo plano). */
  mode: DiscoveryMode;
  /** Aviso amable si no se pudo guardar el modo. */
  modeError: string | null;
}

export type SaveFiltersResult = { ok: true; changed: boolean } | { ok: false; message: string };

export interface DiscoveryPreferencesActions {
  load(): Promise<void>;
  setMode(mode: DiscoveryMode): Promise<void>;
  saveFilters(filters: DiscoveryFilters): Promise<SaveFiltersResult>;
  filters(): DiscoveryFilters;
  reset(): void;
}

export type DiscoveryPreferencesStore = DiscoveryPreferencesState & DiscoveryPreferencesActions;

/** Modo por defecto mientras llegan las preferencias (FIRST VIEWPORT = swipe). */
export const DEFAULT_DISCOVERY_MODE: DiscoveryMode = "swipe";

const INITIAL: DiscoveryPreferencesState = {
  status: "idle",
  preferences: null,
  mode: DEFAULT_DISCOVERY_MODE,
  modeError: null
};

export function createDiscoveryPreferencesStore(
  depsSource: DiscoveryPreferencesDeps | (() => DiscoveryPreferencesDeps | null)
): StoreApi<DiscoveryPreferencesStore> {
  const resolveDeps = () => {
    const deps = typeof depsSource === "function" ? depsSource() : depsSource;

    if (!deps) {
      throw new Error("Discovery preferences used before their API was configured");
    }

    return deps;
  };

  let loadGeneration = 0;
  let modeGeneration = 0;

  return createStore<DiscoveryPreferencesStore>()((set, get) => ({
    ...INITIAL,

    async load() {
      loadGeneration += 1;
      const gen = loadGeneration;
      const hadPreferences = get().preferences !== null;
      set({ status: hadPreferences ? "ready" : "loading" });

      try {
        const preferences = await resolveDeps().get();

        if (gen !== loadGeneration) {
          return;
        }

        set({ status: "ready", preferences, mode: preferences.discoveryMode ?? DEFAULT_DISCOVERY_MODE });
      } catch {
        if (gen !== loadGeneration) {
          return;
        }

        set({ status: hadPreferences ? "ready" : "error" });
      }
    },

    async setMode(mode) {
      const previous = get().mode;

      if (previous === mode) {
        return;
      }

      modeGeneration += 1;
      const gen = modeGeneration;
      set({ mode, modeError: null });

      try {
        const preferences = await resolveDeps().update({ discoveryMode: mode });

        if (gen === modeGeneration) {
          set({ preferences });
        }
      } catch (error) {
        // El modo local se queda: la persona lo ha elegido. Solo avisamos si no se guardó.
        if (gen === modeGeneration) {
          set({
            modeError: friendlyErrorMessage(error, "No hemos podido recordar tu modo favorito, pero puedes seguir así.")
          });
        }
      }
    },

    async saveFilters(filters) {
      const errors = validateFilters(filters);

      if (errors.includes("interested_in_empty")) {
        return { ok: false, message: "Elige al menos un tipo de persona a quien conocer." };
      }

      if (errors.includes("age_range")) {
        return { ok: false, message: "Revisa el rango de edad: entre 18 y 99 años." };
      }

      const current = get().preferences;
      const fields = preferencesFromFilters(filters);
      const changed =
        current === null ||
        (Object.keys(fields) as Array<keyof typeof fields>).some((key) => current[key] !== fields[key]);

      if (!changed) {
        return { ok: true, changed: false };
      }

      try {
        const preferences = await resolveDeps().update(fields);
        set({ preferences, status: "ready" });
        return { ok: true, changed: true };
      } catch (error) {
        return {
          ok: false,
          message: friendlyErrorMessage(error, "No hemos podido guardar tus filtros. Inténtalo otra vez.")
        };
      }
    },

    filters() {
      return filtersFromPreferences(get().preferences);
    },

    reset() {
      loadGeneration += 1;
      modeGeneration += 1;
      set({ ...INITIAL });
    }
  }));
}
