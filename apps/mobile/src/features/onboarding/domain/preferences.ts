import type { DiscoveryPreferences } from "@snack/contracts";

/** «A quién quieres conocer» (multiselección) ↔ flags `show*` de las preferencias. */
export type InterestedIn = "men" | "women" | "non_binary";

export const INTERESTED_VALUES: ReadonlyArray<InterestedIn> = ["women", "men", "non_binary"];

/** Distancia por defecto (debe ser una de las admitidas por backend: 10, 25, 50, 100, 999999). */
export const DEFAULT_DISTANCE_KM = 50;
export const PREFERENCES_MIN_AGE = 18;
export const PREFERENCES_MAX_AGE = 99;

export function interestedFromPreferences(
  preferences: Pick<DiscoveryPreferences, "showMen" | "showWomen" | "showNonBinary"> | null | undefined
): InterestedIn[] {
  if (!preferences) {
    return [];
  }

  return INTERESTED_VALUES.filter((option) => {
    switch (option) {
      case "men":
        return preferences.showMen;
      case "women":
        return preferences.showWomen;
      case "non_binary":
        return preferences.showNonBinary;
    }
  });
}

export function toggleInterested(current: ReadonlyArray<InterestedIn>, option: InterestedIn): InterestedIn[] {
  const next = current.includes(option) ? current.filter((value) => value !== option) : [...current, option];
  // Orden estable (el de las opciones) para que el guardado sea determinista.
  return INTERESTED_VALUES.filter((value) => next.includes(value));
}

function clampAge(value: number): number {
  return Math.min(PREFERENCES_MAX_AGE, Math.max(PREFERENCES_MIN_AGE, Math.round(value)));
}

/**
 * Rango de edad por defecto: un poco más joven y algo más mayor que tú,
 * `max(18, edad-6)`..`min(99, edad+8)`. Sin edad conocida, todo el rango.
 */
export function defaultAgeRange(age: number | null | undefined): { ageMin: number; ageMax: number } {
  if (typeof age !== "number" || !Number.isFinite(age)) {
    return { ageMin: PREFERENCES_MIN_AGE, ageMax: PREFERENCES_MAX_AGE };
  }

  const ageMax = clampAge(age + 8);
  const ageMin = Math.min(clampAge(age - 6), ageMax);
  return { ageMin, ageMax };
}

function interestedFlags(interested: ReadonlyArray<InterestedIn>) {
  return {
    showMen: interested.includes("men"),
    showWomen: interested.includes("women"),
    showNonBinary: interested.includes("non_binary")
  };
}

export type PreferencesUpdate = Pick<
  DiscoveryPreferences,
  "ageMin" | "ageMax" | "distanceKm" | "showMen" | "showWomen" | "showNonBinary"
> &
  Partial<Pick<DiscoveryPreferences, "expandDistance" | "discoveryMode">>;

/**
 * Cuerpo de `PUT /api/me/discovery-preferences` al guardar «a quién quieres
 * conocer». La primera vez crea valores por defecto inteligentes (editables en
 * Filtros); si ya existen, respeta edad/distancia/modo y solo cambia los flags.
 * El endpoint exige siempre ageMin/ageMax/distanceKm.
 */
export function buildInterestedPreferences(
  existing: DiscoveryPreferences | null | undefined,
  interested: ReadonlyArray<InterestedIn>,
  age: number | null | undefined
): PreferencesUpdate {
  const flags = interestedFlags(interested);

  if (existing) {
    return {
      ageMin: existing.ageMin,
      ageMax: existing.ageMax,
      distanceKm: existing.distanceKm,
      ...flags
    };
  }

  return {
    ...defaultAgeRange(age),
    distanceKm: DEFAULT_DISTANCE_KM,
    expandDistance: true,
    discoveryMode: "swipe",
    ...flags
  };
}

/**
 * Plan B si el backend rechaza (422) la edad/distancia guardadas que reenvía
 * `buildInterestedPreferences`: este paso no tiene controles para corregirlas,
 * así que se vuelve a los valores por defecto (edad derivada, 50 km) y se
 * respetan el resto de ajustes (modo, ampliar distancia).
 */
export function buildFallbackInterestedPreferences(
  interested: ReadonlyArray<InterestedIn>,
  age: number | null | undefined
): PreferencesUpdate {
  return {
    ...defaultAgeRange(age),
    distanceKm: DEFAULT_DISTANCE_KM,
    ...interestedFlags(interested)
  };
}
