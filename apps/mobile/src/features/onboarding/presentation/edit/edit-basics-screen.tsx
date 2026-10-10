import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { Gender, RelationshipIntent } from "@cherry/contracts";

import { FormMessage, Icon, Stack, Surface, Text, TextField, useTheme } from "../../../../shared/ui";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { ageFromIsoDate, birthdayPartsFromIso } from "../../domain/birthday";
import {
  DISPLAY_NAME_MAX,
  isGender,
  MIN_INTENTS,
  normalizeDisplayName,
  normalizeIntents,
  sameIntents,
  toggleIntent,
  validateDisplayName
} from "../../domain/profile-fields";
import { ChoiceCard } from "../fields/choice-card";
import { GENDER_OPTIONS, INTENT_OPTIONS } from "../fields/profile-options";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

interface BasicsForm {
  name: string;
  gender: Gender | null;
  intents: RelationshipIntent[];
}

/** Editar lo básico: nombre, género y qué buscas (una o varias; la fecha se ve, pero no se cambia). */
export function EditBasicsScreen() {
  const theme = useTheme();
  const { profile, ready, failed, retry, callApi } = useProfileDraft();
  const leave = useLeaveEdit();
  const { busy, error, setError, run } = useStepSave();
  const [form, setForm] = useState<BasicsForm | null>(null);

  useEffect(() => {
    if (ready && profile && form === null) {
      setForm({
        name: profile.displayName ?? "",
        gender: isGender(profile.gender) ? profile.gender : null,
        intents: normalizeIntents(profile.lookingFor)
      });
    }
  }, [form, profile, ready]);

  const current: BasicsForm = form ?? { name: "", gender: null, intents: [] };
  const nameValidation = validateDisplayName(current.name);
  const dirty =
    !!profile &&
    !!form &&
    (normalizeDisplayName(current.name) !== (profile.displayName ?? "") ||
      current.gender !== profile.gender ||
      !sameIntents(current.intents, normalizeIntents(profile.lookingFor)));
  const canSave = nameValidation.ok && current.gender !== null && current.intents.length >= MIN_INTENTS;
  const birth = birthdayPartsFromIso(profile?.birthDate);
  const age = profile?.age ?? ageFromIsoDate(profile?.birthDate);

  const save = () =>
    void run(async () => {
      if (!nameValidation.ok || !current.gender || current.intents.length < MIN_INTENTS) {
        return;
      }

      const { profile: saved } = await callApi((api) =>
        api.updateProfile({
          displayName: nameValidation.value,
          gender: current.gender,
          lookingFor: current.intents
        })
      );
      useProfileDraftStore.getState().setProfile(saved);
      toastSaved();
      leave();
    }, stepSaveErrorMessage);

  return (
    <EditScaffold
      canSave={canSave}
      dirty={dirty}
      failed={failed}
      loading={!ready || !form}
      onRetry={retry}
      onSave={save}
      saving={busy}
      testID="edit-basics-screen"
      title="Lo básico"
    >
      <Stack gap="xl">
        <TextField
          autoCapitalize="words"
          autoCorrect={false}
          counter={false}
          error={!nameValidation.ok && current.name.length > 0 ? "Ese nombre no nos vale." : null}
          label="Tu nombre"
          maxLength={DISPLAY_NAME_MAX}
          onChangeText={(name) => {
            setForm((value) => (value ? { ...value, name } : value));
            if (error) setError(null);
          }}
          placeholder="Tu nombre"
          testID="edit-basics-name"
          value={current.name}
        />

        <Stack gap="sm">
          <Text variant="label">Fecha de nacimiento</Text>
          <Surface elevation="none" padding="md" radius="md" color="paperDeep">
            <View style={styles.birthRow}>
              <Icon color={theme.semantic.icon.muted} name="lock" size={20} />
              <Text style={styles.flex} variant="bodyStrong">
                {birth.day ? `${birth.day}/${birth.month}/${birth.year}` : "Sin fecha"}
                {age !== null ? ` · ${age} años` : ""}
              </Text>
            </View>
          </Surface>
          <Text color="muted" variant="caption">
            La fecha de nacimiento no se puede cambiar: así la edad que ve la gente siempre es de verdad.
          </Text>
        </Stack>

        <Stack accessibilityRole="radiogroup" gap="sm">
          <Text accessibilityRole="header" variant="title3">
            ¿Cómo te identificas?
          </Text>
          {GENDER_OPTIONS.map((option) => (
            <ChoiceCard
              color="lavanda"
              key={option.value}
              label={option.label}
              onPress={() => setForm((value) => (value ? { ...value, gender: option.value } : value))}
              selected={current.gender === option.value}
              size="md"
              testID={`edit-basics-gender-${option.value}`}
            />
          ))}
        </Stack>

        <Stack gap="sm">
          <Text accessibilityRole="header" variant="title3">
            ¿Qué buscas?
          </Text>
          <Text color="muted" testID="edit-basics-intent-hint" variant="caption">
            {current.intents.length === 0 ? "Elige al menos una para poder guardar." : "Puedes elegir varias."}
          </Text>
          {INTENT_OPTIONS.map((option) => (
            <ChoiceCard
              color="menta"
              description={option.description}
              icon={option.icon}
              key={option.value}
              label={option.label}
              multiple
              onPress={() =>
                setForm((value) => (value ? { ...value, intents: toggleIntent(value.intents, option.value) } : value))
              }
              selected={current.intents.includes(option.value)}
              size="md"
              testID={`edit-basics-intent-${option.value}`}
            />
          ))}
        </Stack>

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </Stack>
    </EditScaffold>
  );
}

const styles = StyleSheet.create({
  birthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  flex: {
    flex: 1
  }
});
