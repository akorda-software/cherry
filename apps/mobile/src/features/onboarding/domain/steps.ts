/**
 * Máquina de pasos del onboarding: una pregunta por pantalla, en este orden.
 * Todo lo que decide "a qué paso voy" vive aquí o en `resume.ts` (puro y testeado).
 */
export const ONBOARDING_STEP_KEYS = [
  "name",
  "birthday",
  "gender",
  "interested",
  "intent",
  "photos",
  "tags",
  "bio",
  "location",
  "done"
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export interface OnboardingStepDefinition {
  key: OnboardingStepKey;
  /** Ruta de expo-router (`/(onboarding)/<key>`). */
  route: `/(onboarding)/${OnboardingStepKey}`;
  /** Paso opcional: nunca bloquea la reanudación ni el final. */
  optional: boolean;
}

/** Pasos opcionales (hoy ninguno: bloquear etiquetas va dentro de «tags»). */
const OPTIONAL_STEP_KEYS: ReadonlyArray<OnboardingStepKey> = [];

/**
 * Rutas que ya no son un paso propio y a qué paso equivalen. `blocked-tags` se
 * fusionó con `tags` (una sola página con «+» y «−»): una ruta antigua en el
 * historial o un enlace viejo cae en la página de etiquetas.
 */
export const LEGACY_STEP_ALIASES: Readonly<Record<string, OnboardingStepKey>> = {
  "blocked-tags": "tags"
};

export const ONBOARDING_STEPS: ReadonlyArray<OnboardingStepDefinition> = ONBOARDING_STEP_KEYS.map(
  (key) => ({
    key,
    route: `/(onboarding)/${key}` as const,
    optional: OPTIONAL_STEP_KEYS.includes(key)
  })
);

export const FIRST_ONBOARDING_STEP: OnboardingStepKey = "name";
export const FINAL_ONBOARDING_STEP: OnboardingStepKey = "done";

export function isOnboardingStepKey(value: unknown): value is OnboardingStepKey {
  return typeof value === "string" && (ONBOARDING_STEP_KEYS as readonly string[]).includes(value);
}

export function stepIndex(key: OnboardingStepKey): number {
  return ONBOARDING_STEP_KEYS.indexOf(key);
}

export function stepRoute(key: OnboardingStepKey): OnboardingStepDefinition["route"] {
  return `/(onboarding)/${key}`;
}

export function nextStepKey(key: OnboardingStepKey): OnboardingStepKey | null {
  return ONBOARDING_STEP_KEYS[stepIndex(key) + 1] ?? null;
}

export function previousStepKey(key: OnboardingStepKey): OnboardingStepKey | null {
  const index = stepIndex(key);
  return index > 0 ? ONBOARDING_STEP_KEYS[index - 1] : null;
}

/** Pasos anteriores a `key` (en orden), para reconstruir el historial al reanudar. */
export function stepsBefore(key: OnboardingStepKey): OnboardingStepKey[] {
  return ONBOARDING_STEP_KEYS.slice(0, stepIndex(key));
}

/** Progreso 0–1 de la barra superior: el primer paso ya enseña un trocito lleno. */
export function stepProgress(key: OnboardingStepKey): number {
  return (stepIndex(key) + 1) / ONBOARDING_STEP_KEYS.length;
}

/**
 * Paso a partir del pathname de expo-router. Los grupos no aparecen en el
 * pathname (`/(onboarding)/photos` → `/photos`), así que se mira el último segmento.
 * Las rutas antiguas (`/blocked-tags`) se traducen a su paso actual.
 */
export function stepFromPathname(pathname: string | null | undefined): OnboardingStepKey | null {
  if (!pathname) {
    return null;
  }

  const segment = pathname.split("?")[0].split("/").filter(Boolean).pop() ?? "";
  if (isOnboardingStepKey(segment)) {
    return segment;
  }

  return Object.prototype.hasOwnProperty.call(LEGACY_STEP_ALIASES, segment) ? LEGACY_STEP_ALIASES[segment] : null;
}
