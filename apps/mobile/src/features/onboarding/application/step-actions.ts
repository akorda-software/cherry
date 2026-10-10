import type { DiscoveryPreferences, Gender, Profile, RelationshipIntent } from "@cherry/contracts";
import type { ProfileApi } from "@cherry/mobile-shared";

import { friendlyErrorMessage } from "../../../shared/api";
import {
  buildFallbackInterestedPreferences,
  buildInterestedPreferences,
  type InterestedIn
} from "../domain/preferences";
import { MIN_INTENTS, normalizeIntents, validateBio, validateDisplayName } from "../domain/profile-fields";
import { firstIncompleteStep, stepForBackendStep, stepForMissingFields } from "../domain/resume";
import type { OnboardingStepKey } from "../domain/steps";

/**
 * Guardado de cada paso (un `PUT`/`POST` por pregunta). Funciones puras sobre
 * `ProfileApi`: la UI solo decide cuándo llamarlas y qué enseñar.
 */
export type StepApi = Pick<
  ProfileApi,
  "getProfile" | "updateProfile" | "updateDiscoveryPreferences" | "completeProfile"
>;

/** Error de validación que se puede enseñar tal cual (antes de llamar a la API). */
export class StepValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepValidationError";
  }
}

const FIELD_MESSAGES: Record<string, string> = {
  display_name: "Ese nombre no nos vale: tiene que tener entre 1 y 50 caracteres.",
  birth_date: "Esa fecha no nos cuadra. Revísala, porfa.",
  gender: "Elige una de las opciones.",
  looking_for: "Elige al menos una de las opciones.",
  what_i_am_looking_for: "Elige al menos una de las opciones.",
  bio: "Tu bio tiene que tener entre 20 y 240 caracteres.",
  age_min: "Revisa el rango de edad.",
  age_max: "Revisa el rango de edad.",
  distance_km: "Esa distancia no está disponible.",
  show_men: "Elige al menos una opción."
};

/** Mensaje amable para errores al guardar un paso (422 de validación incluido). */
export function stepSaveErrorMessage(error: unknown): string {
  if (error instanceof StepValidationError) {
    return error.message;
  }

  const body = (error as { status?: number; body?: unknown } | null)?.body as
    | { errors?: Record<string, unknown> }
    | undefined;

  if (body?.errors && typeof body.errors === "object") {
    const field = Object.keys(body.errors).find((key) => key in FIELD_MESSAGES);

    if (field) {
      return FIELD_MESSAGES[field];
    }
  }

  return friendlyErrorMessage(error, "No hemos podido guardarlo. Inténtalo otra vez.");
}

export async function saveDisplayName(api: StepApi, raw: string): Promise<Profile> {
  const validation = validateDisplayName(raw);

  if (!validation.ok) {
    throw new StepValidationError(
      validation.reason === "empty" ? "Dinos cómo te llamas." : "Ese nombre es muy largo: máximo 50 caracteres."
    );
  }

  const { profile } = await api.updateProfile({ displayName: validation.value });
  return profile;
}

export async function saveBirthDate(api: StepApi, isoDate: string): Promise<Profile> {
  const { profile } = await api.updateProfile({ birthDate: isoDate });
  return profile;
}

export async function saveGender(api: StepApi, gender: Gender): Promise<Profile> {
  const { profile } = await api.updateProfile({ gender });
  return profile;
}

/** Guarda «¿Qué buscas?» (1–4 intenciones, sin repetir). */
export async function saveIntents(api: StepApi, intents: ReadonlyArray<RelationshipIntent>): Promise<Profile> {
  const lookingFor = normalizeIntents(intents);

  if (lookingFor.length < MIN_INTENTS) {
    throw new StepValidationError("Elige al menos una opción.");
  }

  const { profile } = await api.updateProfile({ lookingFor });
  return profile;
}

export async function saveBio(api: StepApi, raw: string): Promise<Profile> {
  const validation = validateBio(raw);

  if (!validation.ok) {
    throw new StepValidationError(
      validation.reason === "too_short"
        ? "Cuéntanos un poquito más: al menos 20 caracteres."
        : "Te has pasado un poco: máximo 240 caracteres."
    );
  }

  const { profile } = await api.updateProfile({ bio: validation.value });
  return profile;
}

export async function saveInterested(
  api: StepApi,
  input: { existing: DiscoveryPreferences | null | undefined; interested: ReadonlyArray<InterestedIn>; age: number | null | undefined }
): Promise<DiscoveryPreferences> {
  if (input.interested.length === 0) {
    throw new StepValidationError("Elige al menos una opción.");
  }

  try {
    const { discoveryPreferences } = await api.updateDiscoveryPreferences(
      buildInterestedPreferences(input.existing, input.interested, input.age)
    );
    return discoveryPreferences;
  } catch (error) {
    // Edad o distancia guardadas que el backend ya no acepta: este paso no deja corregirlas,
    // así que se reintenta UNA vez con los valores por defecto.
    if (!input.existing || (error as { status?: number } | null)?.status !== 422) {
      throw error;
    }

    const { discoveryPreferences } = await api.updateDiscoveryPreferences(
      buildFallbackInterestedPreferences(input.interested, input.age)
    );
    return discoveryPreferences;
  }
}

export type CompleteOnboardingResult =
  | { status: "completed"; profile: Profile }
  | { status: "incomplete"; step: OnboardingStepKey; missing: string[] };

/**
 * Cierra el onboarding. Antes de confirmar comprueba con el perfil fresco las
 * reglas del flujo (fotos y ubicación incluidas, aunque el backend no sea
 * estricto); si el `POST /complete` responde `profile_incomplete`, devuelve el
 * PRIMER paso del flujo que falta según `missing[]`.
 */
export async function completeOnboarding(api: StepApi, now: Date = new Date()): Promise<CompleteOnboardingResult> {
  const { profile } = await api.getProfile();
  const pendingStep = firstIncompleteStep(profile, now);

  if (pendingStep !== "done") {
    return { status: "incomplete", step: pendingStep, missing: [] };
  }

  try {
    const result = await api.completeProfile();
    return { status: "completed", profile: result.profile };
  } catch (error) {
    const candidate = error as { status?: number; code?: string; body?: unknown } | null;
    const body = (candidate?.body ?? {}) as { error?: unknown; missing?: unknown; nextOnboardingStep?: unknown };
    const code = candidate?.code ?? (typeof body.error === "string" ? body.error : null);

    if (code === "profile_incomplete") {
      const missing = Array.isArray(body.missing) ? body.missing.filter((item): item is string => typeof item === "string") : [];
      const step =
        stepForMissingFields(missing) ??
        stepForBackendStep(typeof body.nextOnboardingStep === "string" ? body.nextOnboardingStep : undefined) ??
        "name";
      return { status: "incomplete", step: step === "done" ? "name" : step, missing };
    }

    if (code === "profile_not_found") {
      return { status: "incomplete", step: "name", missing: ["display_name"] };
    }

    throw error;
  }
}
