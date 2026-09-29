import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { Gender, RelationshipIntent } from "@snack/contracts";

import { FormMessage, Icon, Stack, Surface, Text, TextField, useTheme } from "../../../../shared/ui";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { stepSaveErrorMessage } from "../../application/step-actions";
import { ageFromIsoDate, birthdayPartsFromIso } from "../../domain/birthday";
import { DISPLAY_NAME_MAX, isGender, isRelationshipIntent, normalizeDisplayName, validateDisplayName } from "../../domain/profile-fields";
import { ChoiceCard } from "../fields/choice-card";
import { GENDER_OPTIONS, INTENT_OPTIONS } from "../fields/profile-options";
import { useProfileDraft } from "../use-profile-draft";
import { useStepSave } from "../use-step-save";
import { EditScaffold, toastSaved, useLeaveEdit } from "./edit-scaffold";

interface BasicsForm {
  name: string;
  gender: Gender | null;
  intent: RelationshipIntent | null;
}

/** Editar lo básico: nombre, género e intención (la fecha se ve, pero no se cambia). */
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
        intent: isRelationshipIntent(profile.whatIAmLookingFor) ? profile.whatIAmLookingFor : null
      });
    }
  }, [form, profile, ready]);

  const current = form ?? { name: "", gender: null, intent: null };
  const nameValidation = validateDisplayName(current.name);
  const dirty =
    !!profile &&
    !!form &&
    (normalizeDisplayName(current.name) !== (profile.displayName ?? "") ||
      current.gender !== profile.gender ||
      current.intent !== profile.whatIAmLookingFor);
  const canSave = nameValidation.ok && current.gender !== null && current.intent !== null;
  const birth = birthdayPartsFromIso(profile?.birthDate);
  const age = profile?.age ?? ageFromIsoDate(profile?.birthDate);

  const save = () =>
    void run(async () => {
      if (!nameValidation.ok || !current.gender || !current.intent) {
        return;
      }

      const { profile: saved } = await callApi((api) =>
        api.updateProfile({
          displayName: nameValidation.value,
          gender: current.gender,
          whatIAmLookingFor: current.intent
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

        <Stack accessibilityRole="radiogroup" gap="sm">
          <Text accessibilityRole="header" variant="title3">
            ¿Qué buscas?
          </Text>
          {INTENT_OPTIONS.map((option) => (
            <ChoiceCard
              color="menta"
              description={option.description}
              icon={option.icon}
              key={option.value}
              label={option.label}
              onPress={() => setForm((value) => (value ? { ...value, intent: option.value } : value))}
              selected={current.intent === option.value}
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
