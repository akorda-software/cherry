import {
  MAX_POSITIVE_TAGS,
  MAX_PROFILE_PHOTOS,
  type DiscoveryPreferences,
  type Gender,
  type Profile,
  type RelationshipIntent
} from "@snack/contracts";

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
  return intent ? OWN_INTENT_LABELS[intent] : null;
}

/** «30 años · Mujer · Una relación» (solo lo que haya). */
export function describeBasics(profile: Pick<Profile, "age" | "gender" | "whatIAmLookingFor">): string {
  const parts = [
    profile.age !== null ? `${profile.age} años` : null,
    genderLabel(profile.gender),
    ownIntentLabel(profile.whatIAmLookingFor)
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

/** «18–35 años · 25 km». */
export function describeFilters(preferences: DiscoveryPreferences | null): string | null {
  if (preferences === null) {
    return null;
  }

  return `${preferences.ageMin}–${preferences.ageMax} años · ${preferences.distanceKm} km`;
}
