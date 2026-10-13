import {
  MAX_POSITIVE_TAGS,
  MAX_PROFILE_PHOTOS,
  type DiscoveryPreferences,
  type Gender,
  type Profile,
  type RelationshipIntent
} from "@cherry/contracts";

const GENDER_LABELS: Record<Gender, string> = {
  woman: "Mujer",
  man: "Hombre",
  non_binary: "No binario"
};

/** Qué buscas, contado en tu voz (tuteo). */
const OWN_INTENT_LABELS: Record<RelationshipIntent, string> = {
  relationship: "Una relación",
  casual: "Algo casual",
  meet_people: "Conocer gente",
  go_with_the_flow: "A ver qué pasa"
};

export function genderLabel(gender: Gender | null): string | null {
  return gender ? GENDER_LABELS[gender] : null;
}

export function ownIntentLabel(intent: RelationshipIntent | null): string | null {
  return intent ? (OWN_INTENT_LABELS[intent] ?? null) : null;
}

/** «Una relación · Conocer gente» (en el orden en que llegan, que es el canónico); `null` si no hay ninguna. */
export function ownIntentsLabel(intents: ReadonlyArray<RelationshipIntent> | null | undefined): string | null {
  const labels = (intents ?? []).map(ownIntentLabel).filter((label): label is string => label !== null);
  return labels.length > 0 ? labels.join(" · ") : null;
}

/** «30 años · Mujer · Una relación · Conocer gente» (solo lo que haya). */
export function describeBasics(profile: Pick<Profile, "age" | "gender" | "lookingFor">): string {
  const parts = [
    profile.age !== null ? `${profile.age} años` : null,
    genderLabel(profile.gender),
    ownIntentsLabel(profile.lookingFor)
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : "Por completar";
}

/** «3 de 4». */
export function describePhotoCount(count: number): string {
  return `${count} de ${MAX_PROFILE_PHOTOS}`;
}

/** «5 de 8». */
export function describeTagCount(count: number): string {
  return `${count} de ${MAX_POSITIVE_TAGS}`;
}

/** Principio de tu bio, para la fila «Sobre mí». */
export function describeBio(bio: string | null, maxLength = 48): string {
  const clean = bio?.replace(/\s+/g, " ").trim() ?? "";

  if (clean === "") {
    return "Sin escribir todavía";
  }

  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Valor de `distanceKm` que el backend usa como «sin límite» (`DiscoveryPreference.unlimited_distance_km`). */
const UNLIMITED_DISTANCE_KM = 999_999;

/** «18–35 años · 25 km» (o «· Sin límite» si el radio es ilimitado). */
export function describeFilters(preferences: DiscoveryPreferences | null): string | null {
  if (preferences === null) {
    return null;
  }

  const distance =
    preferences.distanceKm >= UNLIMITED_DISTANCE_KM ? "Sin límite" : `${preferences.distanceKm} km`;

  return `${preferences.ageMin}–${preferences.ageMax} años · ${distance}`;
}
