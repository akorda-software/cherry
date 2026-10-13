import { useEffect, useRef } from "react";
import { create } from "zustand";

import type { OnboardingStepKey } from "../domain/steps";

/**
 * El marco del onboarding pinta UNA llamada a la acción fija abajo; cada paso
 * declara la suya (texto, si está habilitada, si está guardando…). El registro
 * va por paso porque la pila nativa mantiene montados los pasos anteriores: el
 * marco enseña siempre la del paso visible.
 */
export interface StepSecondaryAction {
  label: string;
  onPress: () => void;
  testID?: string;
}

export interface StepCtaConfig {
  label: string;
  enabled: boolean;
  busy: boolean;
  onPress: () => void;
  testID?: string;
  /** Acción secundaria (p. ej. «Saltar»). */
  secondary?: StepSecondaryAction | null;
  /** Línea corta encima del botón («Te falta 1 foto»). */
  hint?: string | null;
  /** Oculta el botón (p. ej. mientras se celebra). */
  hidden?: boolean;
}

interface StepCtaStore {
  byStep: Partial<Record<OnboardingStepKey, StepCtaConfig>>;
  register(step: OnboardingStepKey, config: StepCtaConfig | null): void;
}

export const useStepCtaStore = create<StepCtaStore>((set) => ({
  byStep: {},
  register: (step, config) =>
    set((state) => {
      const byStep = { ...state.byStep };

      if (config) {
        byStep[step] = config;
      } else {
        delete byStep[step];
      }

      return { byStep };
    })
}));

export interface UseStepCtaInput {
  label?: string;
  enabled: boolean;
  busy?: boolean;
  onPress: () => void;
  testID?: string;
  secondary?: StepSecondaryAction | null;
  hint?: string | null;
  hidden?: boolean;
}

/**
 * Declara la llamada a la acción de un paso. Los callbacks se guardan en refs:
 * solo se vuelve a registrar cuando cambia algo visible.
 */
export function useStepCta(step: OnboardingStepKey, input: UseStepCtaInput) {
  const register = useStepCtaStore((state) => state.register);
  const onPressRef = useRef(input.onPress);
  const secondaryRef = useRef(input.secondary?.onPress);
  onPressRef.current = input.onPress;
  secondaryRef.current = input.secondary?.onPress;

  const label = input.label ?? "Continuar";
  const enabled = input.enabled;
  const busy = input.busy ?? false;
  const hidden = input.hidden ?? false;
  const testID = input.testID ?? `onboarding-cta-${step}`;
  const secondaryLabel = input.secondary?.label ?? null;
  const secondaryTestID = input.secondary?.testID;
  const hint = input.hint ?? null;

  useEffect(() => {
    register(step, {
      label,
      enabled,
      busy,
      hidden,
      testID,
      hint,
      onPress: () => onPressRef.current(),
      secondary: secondaryLabel
        ? { label: secondaryLabel, testID: secondaryTestID, onPress: () => secondaryRef.current?.() }
        : null
    });
  }, [busy, enabled, hidden, hint, label, register, secondaryLabel, secondaryTestID, step, testID]);

  useEffect(() => () => register(step, null), [register, step]);
}
