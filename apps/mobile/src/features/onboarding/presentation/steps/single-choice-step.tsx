import { useEffect, useRef, useState } from "react";

import { FormMessage, Stack } from "../../../../shared/ui";
import { useStepCta } from "../../application/step-cta-store";
import type { OnboardingStepKey } from "../../domain/steps";
import { ChoiceCard } from "../fields/choice-card";
import type { ProfileOption } from "../fields/profile-options";
import { StepPage } from "../step-page";
import { stepAccent } from "../step-tones";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useScreenReaderEnabled } from "../use-screen-reader";
import { useStepSave } from "../use-step-save";

/** Pausa para que se vea la tarjeta elegida antes de pasar página. */
const AUTO_ADVANCE_MS = 260;

export interface SingleChoiceStepProps<T extends string> {
  step: OnboardingStepKey;
  title: string;
  subtitle?: string;
  options: ReadonlyArray<ProfileOption<T>>;
  /** Valor guardado (`undefined` mientras carga el borrador). */
  saved: T | null | undefined;
  ready: boolean;
  save(value: T): Promise<void>;
  testID: string;
}

/**
 * Pregunta de una sola respuesta (género, intención): un toque elige, guarda y
 * pasa página solo. El botón «Continuar» sigue ahí para quien vuelve atrás.
 */
export function SingleChoiceStep<T extends string>({
  step,
  title,
  subtitle,
  options,
  saved,
  ready,
  save,
  testID
}: SingleChoiceStepProps<T>) {
  const navigation = useOnboardingNavigation();
  const screenReader = useScreenReaderEnabled();
  const { busy, error, run } = useStepSave();
  const [selected, setSelected] = useState<T | null>(null);
  const initialized = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      setSelected(saved ?? null);
    }
  }, [ready, saved]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const commit = (value: T) =>
    run(async () => {
      if (value !== saved) {
        await save(value);
      }

      navigation.goNext(step);
    });

  const choose = (value: T) => {
    setSelected(value);

    if (screenReader || busy) {
      return;
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commit(value), AUTO_ADVANCE_MS);
  };

  useStepCta(step, {
    enabled: ready && selected !== null,
    busy,
    onPress: () => {
      if (timer.current) clearTimeout(timer.current);
      if (selected) void commit(selected);
    }
  });

  return (
    <StepPage step={step} subtitle={subtitle} testID={testID} title={title}>
      <Stack accessibilityRole="radiogroup" gap="md">
        {options.map((option) => (
          <ChoiceCard
            color={stepAccent(step)}
            description={option.description}
            disabled={!ready}
            icon={option.icon}
            key={option.value}
            label={option.label}
            onPress={() => choose(option.value)}
            selected={selected === option.value}
            testID={`${testID}-${option.value}`}
          />
        ))}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </Stack>
    </StepPage>
  );
}
