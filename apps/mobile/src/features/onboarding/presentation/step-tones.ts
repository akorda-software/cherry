import type { PastelName } from "../../../shared/ui";
import type { OnboardingStepKey } from "../domain/steps";

/**
 * Papel de cada página del onboarding (raise del contrato: el fondo cambia de
 * pastel en cada paso). Dos pasos seguidos nunca comparten tono y ninguno
 * coincide con lo que se pinta encima (notas limonada, pegatinas bloqueadas tomate).
 */
export const STEP_TONES: Record<OnboardingStepKey, PastelName> = {
  name: "fresa",
  birthday: "limonada",
  gender: "lavanda",
  interested: "cielo",
  intent: "menta",
  photos: "melocoton",
  tags: "limonada",
  "blocked-tags": "lavanda",
  bio: "cielo",
  location: "menta",
  done: "fresa"
};

/** Relleno de las tarjetas elegidas en cada paso: el pastel del papel, en su tono pleno. */
export function stepAccent(step: OnboardingStepKey): PastelName {
  return STEP_TONES[step];
}
