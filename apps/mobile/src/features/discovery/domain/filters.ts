import type { DiscoveryPreferences, Gender } from "@snack/contracts";

/** Rango de edad que ofrece el filtro (el backend admite 18–100). */
export const FILTER_AGE_MIN = 18;
export const FILTER_AGE_MAX = 99;

/** 999999 = «Sin límite» (valor que entiende el backend). */
export const UNLIMITED_DISTANCE_KM = 999_999;

export const DISTANCE_OPTIONS = [10, 25, 50, 100, UNLIMITED_DISTANCE_KM] as const;

export type DistanceOption = (typeof DISTANCE_OPTIONS)[number];

export const INTERESTED_IN_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "woman", label: "Mujeres" },
  { value: "man", label: "Hombres" },
  { value: "non_binary", label: "Personas no binarias" }
];

/** Filtros tal y como los edita la pantalla (independientes del formato del backend). */
export interface DiscoveryFilters {
  ageMin: number;
  ageMax: number;
  distanceKm: DistanceOption;
  interestedIn: Gender[];
  expandDistance: boolean;
  compatibleOnly: boolean;
}

export const DEFAULT_FILTERS: DiscoveryFilters = {
  ageMin: 18,
  ageMax: 45,
  distanceKm: 50,
  interestedIn: ["woman", "man", "non_binary"],
  expandDistance: true,
  compatibleOnly: false
};

export function distanceLabel(km: DistanceOption): string {
  return km === UNLIMITED_DISTANCE_KM ? "Sin límite" : `${km} km`;
}

/** Ajusta cualquier distancia guardada a la opción válida más cercana. */
export function snapDistance(km: number | null | undefined): DistanceOption {
  if (typeof km !== "number" || !Number.isFinite(km)) {
    return DEFAULT_FILTERS.distanceKm;
  }

  if (km > 100) {
    return UNLIMITED_DISTANCE_KM;
  }

  let best: DistanceOption = DISTANCE_OPTIONS[0];

  for (const option of DISTANCE_OPTIONS) {
    if (Math.abs(option - km) < Math.abs(best - km)) {
      best = option;
    }
  }

  return best;
}

function clampAge(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(FILTER_AGE_MAX, Math.max(FILTER_AGE_MIN, Math.round(value)));
}

export function filtersFromPreferences(preferences: DiscoveryPreferences | null | undefined): DiscoveryFilters {
  if (!preferences) {
    return { ...DEFAULT_FILTERS, interestedIn: [...DEFAULT_FILTERS.interestedIn] };
  }

  const ageMin = clampAge(preferences.ageMin, DEFAULT_FILTERS.ageMin);
  const ageMax = Math.max(ageMin, clampAge(preferences.ageMax, DEFAULT_FILTERS.ageMax));
  const interestedIn: Gender[] = [];

  if (preferences.showWomen) interestedIn.push("woman");
  if (preferences.showMen) interestedIn.push("man");
  if (preferences.showNonBinary) interestedIn.push("non_binary");

  return {
    ageMin,
    ageMax,
    distanceKm: snapDistance(preferences.distanceKm),
    interestedIn,
    expandDistance: preferences.expandDistance !== false,
    compatibleOnly: preferences.compatibleOnly === true
  };
}

/** Campos para `PUT /api/me/discovery-preferences` (no toca `discoveryMode`). */
export function preferencesFromFilters(
  filters: DiscoveryFilters
): Omit<DiscoveryPreferences, "discoveryMode"> {
  return {
    ageMin: filters.ageMin,
    ageMax: filters.ageMax,
    distanceKm: filters.distanceKm,
    showMen: filters.interestedIn.includes("man"),
    showWomen: filters.interestedIn.includes("woman"),
    showNonBinary: filters.interestedIn.includes("non_binary"),
    expandDistance: filters.expandDistance,
    compatibleOnly: filters.compatibleOnly
  };
}

export type FiltersError = "interested_in_empty" | "age_range";

export function validateFilters(filters: DiscoveryFilters): FiltersError[] {
  const errors: FiltersError[] = [];

  if (filters.interestedIn.length === 0) {
    errors.push("interested_in_empty");
  }

  if (
    filters.ageMin < FILTER_AGE_MIN ||
    filters.ageMax > FILTER_AGE_MAX ||
    filters.ageMin > filters.ageMax
  ) {
    errors.push("age_range");
  }

  return errors;
}

/** Cambia una opción de «a quién quiero conocer» sin dejar nunca la lista vacía. */
export function toggleInterestedIn(current: Gender[], value: Gender): Gender[] {
  if (current.includes(value)) {
    return current.length === 1 ? current : current.filter((item) => item !== value);
  }

  const next = [...current, value];

  return INTERESTED_IN_OPTIONS.map((option) => option.value).filter((option) => next.includes(option));
}

export function sameFilters(a: DiscoveryFilters, b: DiscoveryFilters): boolean {
  return (
    a.ageMin === b.ageMin &&
    a.ageMax === b.ageMax &&
    a.distanceKm === b.distanceKm &&
    a.expandDistance === b.expandDistance &&
    a.compatibleOnly === b.compatibleOnly &&
    a.interestedIn.length === b.interestedIn.length &&
    a.interestedIn.every((value) => b.interestedIn.includes(value))
  );
}

/** «25–34 años» o «Desde 30 años» para resúmenes. */
export function ageRangeLabel(filters: Pick<DiscoveryFilters, "ageMin" | "ageMax">): string {
  if (filters.ageMin === filters.ageMax) {
    return `${filters.ageMin} años`;
  }

  return filters.ageMax >= FILTER_AGE_MAX
    ? `Desde ${filters.ageMin} años`
    : `${filters.ageMin}–${filters.ageMax} años`;
}
