import { MAX_PROFILE_PHOTOS, MIN_PROFILE_PHOTOS, type OnboardingStep, type Profile } from "@snack/contracts";

import { BACKEND_MIN_POSITIVE_TAGS } from "../../tags/domain/tag-selection";
import { isAdultBirthDate } from "./birthday";
import { interestedFromPreferences } from "./preferences";
import { isGender, normalizeIntents, validateBio, validateDisplayName } from "./profile-fields";
import { ONBOARDING_STEP_KEYS, stepIndex, type OnboardingStepKey } from "./steps";

/**
 * Reanudación del onboarding. El orden de comprobación es EL DEL FLUJO (no el
 * del backend, que pone bio y fotos antes que las preferencias): así una
 * persona que vuelve cae justo en la primera pregunta que dejó sin contestar.
 */
export type RequiredStepKey = Exclude<OnboardingStepKey, "done">;

export type StepCompletion = Record<RequiredStepKey, boolean>;

export function activePhotoCount(profile: Pick<Profile, "photos"> | null | undefined): number {
  return (profile?.photos ?? []).filter((photo) => photo.isActive).length;
}

/** Qué pasos obligatorios están resueltos según `GET /api/me/profile`. */
export function profileStepCompletion(profile: Profile | null | undefined, now: Date = new Date()): StepCompletion {
  if (!profile) {
    return {
      name: false,
      birthday: false,
      gender: false,
      interested: false,
      intent: false,
      photos: false,
      tags: false,
      bio: false,
      location: false
    };
  }

  const photos = activePhotoCount(profile);

  return {
    name: validateDisplayName(profile.displayName).ok,
    birthday: isAdultBirthDate(profile.birthDate, now),
    gender: isGender(profile.gender),
    interested: interestedFromPreferences(profile.discoveryPreferences).length > 0,
    intent: normalizeIntents(profile.lookingFor).length > 0,
    photos: photos >= MIN_PROFILE_PHOTOS && photos <= MAX_PROFILE_PHOTOS,
    // Mismo criterio que el backend (≥1): no se rebota a nadie al paso de etiquetas.
    tags: (profile.tags ?? []).length >= BACKEND_MIN_POSITIVE_TAGS,
    bio: validateBio(profile.bio).ok,
    location: profile.hasLocation === true
  };
}

/** Primer paso obligatorio sin resolver, en el orden del flujo; `done` si no falta nada. */
export function firstIncompleteStep(profile: Profile | null | undefined, now: Date = new Date()): OnboardingStepKey {
  const completion = profileStepCompletion(profile, now);

  for (const key of ONBOARDING_STEP_KEYS) {
    if (key === "done") {
      continue;
    }

    if (!completion[key]) {
      return key;
    }
  }

  return "done";
}

const BACKEND_STEP_TO_STEP: Record<OnboardingStep, OnboardingStepKey> = {
  name: "name",
  birth_date: "birthday",
  gender: "gender",
  intent: "intent",
  bio: "bio",
  photos: "photos",
  interested_in: "interested",
  discovery_preferences: "interested",
  tags: "tags",
  location: "location"
};

/**
 * `nextOnboardingStep` del bootstrap/feed → paso del flujo. `null` significa que
 * backend no echa nada en falta: toca confirmar (`done`, que vuelve a comprobarlo).
 * Un valor desconocido devuelve `null` para que quien llama decida.
 */
export function stepForBackendStep(step: OnboardingStep | string | null | undefined): OnboardingStepKey | null {
  if (step === null || step === undefined) {
    return "done";
  }

  return (BACKEND_STEP_TO_STEP as Record<string, OnboardingStepKey>)[step] ?? null;
}

const MISSING_FIELD_TO_STEP: Record<string, OnboardingStepKey> = {
  display_name: "name",
  displayName: "name",
  birth_date: "birthday",
  birthDate: "birthday",
  gender: "gender",
  looking_for: "intent",
  lookingFor: "intent",
  what_i_am_looking_for: "intent",
  whatIAmLookingFor: "intent",
  bio: "bio",
  photos: "photos",
  interested_in: "interested",
  interestedIn: "interested",
  discovery_preferences: "interested",
  discoveryPreferences: "interested",
  tags: "tags",
  location: "location"
};

/** `missing[]` de un 422 `profile_incomplete` → el PRIMER paso del flujo que falta. */
export function stepForMissingFields(missing: ReadonlyArray<string> | null | undefined): OnboardingStepKey | null {
  let best: OnboardingStepKey | null = null;

  for (const field of missing ?? []) {
    const step = MISSING_FIELD_TO_STEP[field];

    if (step && (best === null || stepIndex(step) < stepIndex(best))) {
      best = step;
    }
  }

  return best;
}

export type ResumeInput =
  | { source: "profile"; profile: Profile | null; now?: Date }
  | { source: "bootstrap"; nextOnboardingStep: OnboardingStep | string | null | undefined };

/**
 * Paso en el que reanudar. Con el perfil (fuente de verdad) se calcula el
 * primer paso incompleto; si no se pudo cargar, se usa la pista del bootstrap.
 */
export function resolveResumeStep(input: ResumeInput): OnboardingStepKey {
  if (input.source === "profile") {
    return firstIncompleteStep(input.profile, input.now);
  }

  return stepForBackendStep(input.nextOnboardingStep) ?? "name";
}
