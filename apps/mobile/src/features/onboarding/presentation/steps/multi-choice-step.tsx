import { useEffect, useRef, useState } from "react";

import { FormMessage, Stack } from "../../../../shared/ui";
import { useStepCta } from "../../application/step-cta-store";
import type { OnboardingStepKey } from "../../domain/steps";
import { ChoiceCard } from "../fields/choice-card";
import type { ProfileOption } from "../fields/profile-options";
import { StepPage } from "../step-page";
import { stepAccent } from "../step-tones";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useStepSave } from "../use-step-save";

export interface MultiChoiceStepProps<T extends string> {
  step: OnboardingStepKey;
  title: string;
  subtitle?: string;
  options: ReadonlyArray<ProfileOption<T>>;
  /** Valores guardados (`undefined` mientras carga el borrador). */
  saved: ReadonlyArray<T> | undefined;
  ready: boolean;
  /** Mínimo de opciones para poder continuar (1 por defecto). */
  min?: number;
  /** Recibe la selección en el orden de `options`. */
  save(values: T[]): Promise<void>;
  testID: string;
}

function sameSelection<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * Pregunta de varias respuestas con las mismas tarjetas que las de una sola:
 * un toque marca o desmarca (casilla con ✓, no solo color) y «Continuar» guarda
 * y pasa página cuando hay al menos `min` marcadas. No avanza sola: quien marca
 * una puede querer marcar otra.
 */
export function MultiChoiceStep<T extends string>({
  step,
  title,
  subtitle,
  options,
  saved,
  ready,
  min = 1,
  save,
  testID
}: MultiChoiceStepProps<T>) {
  const navigation = useOnboardingNavigation();
  const { busy, error, run } = useStepSave();
  const [selected, setSelected] = useState<T[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      setSelected(options.map((option) => option.value).filter((value) => saved?.includes(value)));
    }
  }, [options, ready, saved]);

  const toggle = (value: T) =>
    setSelected((current) => {
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      // Orden estable (el de las opciones) para que el guardado sea determinista.
      return options.map((option) => option.value).filter((item) => next.includes(item));
    });

  const enough = selected.length >= min;

  useStepCta(step, {
    enabled: ready && enough,
    busy,
    hint: ready && !enough ? (min === 1 ? "Elige al menos una" : `Elige al menos ${min}`) : null,
    onPress: () =>
      void run(async () => {
        if (!sameSelection(selected, saved ?? [])) {
          await save(selected);
        }

        navigation.goNext(step);
      })
  });

  return (
    <StepPage step={step} subtitle={subtitle} testID={testID} title={title}>
      <Stack gap="md">
        {options.map((option) => (
          <ChoiceCard
            color={stepAccent(step)}
            description={option.description}
            disabled={!ready}
            icon={option.icon}
            key={option.value}
            label={option.label}
            multiple
            onPress={() => toggle(option.value)}
            selected={selected.includes(option.value)}
            testID={`${testID}-${option.value}`}
          />
        ))}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </Stack>
    </StepPage>
  );
}
