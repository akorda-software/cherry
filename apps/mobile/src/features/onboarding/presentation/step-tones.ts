import type { PastelName } from "../../../shared/ui";
import type { OnboardingStepKey } from "../domain/steps";

/**
 * Color de acento de cada paso del onboarding: barra de progreso, rotulador del
 * título y tarjetas elegidas. El papel no se tiñe. Dos pasos seguidos nunca
 * comparten color y se evitan menta y tomate (significan «me gusta» y «bloqueo»).
 */
export const STEP_TONES: Record<OnboardingStepKey, PastelName> = {
  name: "fresa",
  birthday: "limonada",
  gender: "lavanda",
  interested: "cielo",
  intent: "melocoton",
  photos: "limonada",
  tags: "lavanda",
  bio: "cielo",
  location: "melocoton",
  done: "fresa"
};

/** Relleno de las tarjetas elegidas en cada paso: su color de acento, en su tono pleno. */
export function stepAccent(step: OnboardingStepKey): PastelName {
  return STEP_TONES[step];
}
