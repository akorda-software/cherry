import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { FormMessage, Icon, Stack, Text, useTheme } from "../../../../shared/ui";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveInterested } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { ageFromIsoDate } from "../../domain/birthday";
import {
  buildInterestedPreferences,
  type InterestedIn,
  interestedFromPreferences,
  toggleInterested
} from "../../domain/preferences";
import { ChoiceCard } from "../fields/choice-card";
import { INTERESTED_OPTIONS } from "../fields/profile-options";
import { StepPage } from "../step-page";
import { stepAccent } from "../step-tones";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

function sameSelection(a: ReadonlyArray<InterestedIn>, b: ReadonlyArray<InterestedIn>) {
  return a.length === b.length && a.every((value) => b.includes(value));
}

function distanceText(km: number) {
  return km >= 999_999 ? "estén donde estén" : `a menos de ${km} km`;
}

/**
 * Paso 4: a quién quieres conocer (varias). Al guardar crea también unas
 * preferencias de descubrimiento con sentido (edad y distancia), editables en Filtros.
 */
export function InterestedStep() {
  const theme = useTheme();
  const { profile, ready, callApi } = useProfileDraft();
  const navigation = useOnboardingNavigation();
  const { busy, error, run } = useStepSave();
  const [selected, setSelected] = useState<InterestedIn[]>([]);
  const initialized = useRef(false);

  const existing = profile?.discoveryPreferences ?? null;
  const saved = useMemo(() => interestedFromPreferences(existing), [existing]);
  const age = profile?.age ?? ageFromIsoDate(profile?.birthDate);

  useEffect(() => {
    if (ready && !initialized.current) {
      initialized.current = true;
      setSelected(saved);
    }
  }, [ready, saved]);

  const preview = useMemo(() => buildInterestedPreferences(existing, ["women"], age), [age, existing]);

  const submit = () =>
    void run(async () => {
      if (!existing || !sameSelection(selected, saved)) {
        const preferences = await callApi((api) => saveInterested(api, { existing, interested: selected, age }));
        useProfileDraftStore.getState().setPreferences(preferences);
      }

      navigation.goNext("interested");
    });

  useStepCta("interested", { enabled: ready && selected.length > 0, busy, onPress: submit });

  return (
    <StepPage step="interested" subtitle="Elige todas las que quieras." testID="onboarding-step-interested" title="¿A quién quieres conocer?">
      <Stack gap="md">
        {INTERESTED_OPTIONS.map((option) => (
          <ChoiceCard
            color={stepAccent("interested")}
            disabled={!ready}
            key={option.value}
            label={option.label}
            multiple
            onPress={() => setSelected((current) => toggleInterested(current, option.value))}
            selected={selected.includes(option.value)}
            testID={`onboarding-interested-${option.value}`}
          />
        ))}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <View style={styles.note}>
          <Icon color={theme.semantic.icon.muted} name="sliders" size={20} />
          <Text color="muted" style={styles.noteText} variant="callout">
            {`Te enseñaremos gente de ${preview.ageMin} a ${preview.ageMax} años ${distanceText(preview.distanceKm)}. Lo cambias cuando quieras en Filtros.`}
          </Text>
        </View>
      </Stack>
    </StepPage>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 4
  },
  noteText: {
    flex: 1
  }
});
