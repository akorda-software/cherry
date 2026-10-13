import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { useMinimumAge } from "../../../../shared/config";
import { Icon, PopIn, Sticker, Text, useTheme } from "../../../../shared/ui";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { saveBirthDate } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import {
  type BirthdayParts,
  birthdayPartsFromIso,
  EMPTY_BIRTHDAY,
  isBirthdayPartOutOfRange,
  validateBirthday
} from "../../domain/birthday";
import { BirthdayField } from "../fields/birthday-field";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";

function birthdayMessage(
  parts: BirthdayParts,
  validation: ReturnType<typeof validateBirthday>,
  minimumAge: number
): string | null {
  if (isBirthdayPartOutOfRange("day", parts.day)) return "Ese día no existe. Revisa el número.";
  if (isBirthdayPartOutOfRange("month", parts.month)) return "Los meses van del 01 al 12.";
  if (isBirthdayPartOutOfRange("year", parts.year)) return "¿Seguro? Revisa el año.";

  switch (validation.status) {
    case "invalid":
      return "Esa fecha no existe. Revisa el día y el mes.";
    case "future":
      return "Esa fecha aún no ha llegado.";
    case "too_young":
      return `Cherry es solo para mayores de ${minimumAge}. ¡Te esperamos cuando llegue el día!`;
    case "implausible":
      return "¿Seguro? Revisa el año.";
    default:
      return null;
  }
}

/** Paso 2: fecha de nacimiento en tres casillas; valida la edad mínima de la instancia (18+) y celebra la edad. */
export function BirthdayStep() {
  const theme = useTheme();
  const { profile, ready, callApi } = useProfileDraft();
  const navigation = useOnboardingNavigation();
  const { busy, error: saveError, run } = useStepSave();
  const [parts, setParts] = useState<BirthdayParts | null>(null);

  useEffect(() => {
    if (ready && parts === null) {
      setParts(profile?.birthDate ? birthdayPartsFromIso(profile.birthDate) : { ...EMPTY_BIRTHDAY });
    }
  }, [parts, profile?.birthDate, ready]);

  const value = parts ?? EMPTY_BIRTHDAY;
  const minimumAge = useMinimumAge();
  const validation = useMemo(() => validateBirthday(value, new Date(), minimumAge), [minimumAge, value]);
  const message = birthdayMessage(value, validation, minimumAge);
  const valid = validation.status === "valid";

  const submit = () => {
    if (validation.status !== "valid") {
      return;
    }

    void run(async () => {
      if (validation.isoDate !== profile?.birthDate) {
        const saved = await callApi((api) => saveBirthDate(api, validation.isoDate));
        useProfileDraftStore.getState().setProfile(saved);
      }

      navigation.goNext("birthday");
    });
  };

  useStepCta("birthday", { enabled: valid && ready, busy, onPress: submit });

  return (
    <StepPage step="birthday" subtitle="Solo enseñamos tu edad, nunca la fecha." testID="onboarding-step-birthday" title="¿Cuándo naciste?">
      <BirthdayField autoFocus error={message ?? saveError} onChange={setParts} value={value} />
      <View style={styles.ageSlot}>
        {validation.status === "valid" ? (
          <PopIn key={validation.age} rotate={-3}>
            <Sticker color="limonada" padding={{ x: 16, y: 10 }} testID="onboarding-birthday-age">
              <View style={styles.ageRow}>
                <Icon color={theme.primitives.color.ink} fill={theme.primitives.color.fresa} name="cake" size={24} />
                <Text variant="title3">{`Tienes ${validation.age} años`}</Text>
              </View>
            </Sticker>
          </PopIn>
        ) : null}
      </View>
    </StepPage>
  );
}

const styles = StyleSheet.create({
  ageSlot: {
    minHeight: 64,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: 8
  },
  ageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  }
});
