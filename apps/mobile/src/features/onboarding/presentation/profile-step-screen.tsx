import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";

import type { Gender, RelationshipIntent } from "@cherry/contracts";

import { refreshBootstrap } from "../../app-bootstrap/presentation/app-bootstrap-provider";
import { FormMessage, Screen, Stack, useTheme } from "../../../shared/ui";
import { ChoiceGroup } from "./choice-group";
import { DatePickerField } from "./date-picker-field";
import { SaveButton } from "./save-button";
import { TextField } from "./text-field";
import { useProfileApi } from "./use-profile-api";

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "man", label: "Hombre" },
  { value: "woman", label: "Mujer" },
  { value: "non_binary", label: "No binario" }
];

const INTENT_OPTIONS: ReadonlyArray<{ value: RelationshipIntent; label: string }> = [
  { value: "relationship", label: "Relación" },
  { value: "casual", label: "Casual" },
  { value: "meet_people", label: "Conocer gente" },
  { value: "go_with_the_flow", label: "A ver qué pasa" }
];

type Status = "loading" | "ready" | "saving";

function maxBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

function minBirthDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 120);
  return d;
}

export function ProfileStepScreen() {
  const theme = useTheme();
  const router = useRouter();
  const callApi = useProfileApi();

  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [intent, setIntent] = useState<RelationshipIntent | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const { profile } = await callApi((api) => api.getProfile());
        if (cancelled) return;
        if (profile) {
          setDisplayName(profile.displayName ?? "");
          setBirthDate(profile.birthDate ?? "");
          setGender(profile.gender);
          setIntent(profile.whatIAmLookingFor);
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el perfil");
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callApi]);

  const validationError = useMemo(() => {
    if (!displayName.trim()) return "Decinos cómo te llamás";
    if (!birthDate) return "Elegí tu fecha de nacimiento";

    const date = new Date(`${birthDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return "Fecha inválida";

    const ageMs = Date.now() - date.getTime();
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 18) return "Tenés que ser mayor de 18";
    if (ageYears > 120) return "Fecha poco creíble";

    if (!gender) return "Elegí una identidad";
    if (!intent) return "Elegí qué buscás";
    return null;
  }, [birthDate, displayName, gender, intent]);

  const handleSave = useCallback(async () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await callApi((api) =>
        api.updateProfile({
          displayName: displayName.trim(),
          birthDate,
          gender,
          whatIAmLookingFor: intent
        })
      );
      await refreshBootstrap();
      setSavedAt(Date.now());
      setStatus("ready");
      router.replace("/(onboarding)/bio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setStatus("ready");
    }
  }, [birthDate, callApi, displayName, gender, intent, router, validationError]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flexGrow: 1 },
        fieldLabel: {
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "800" as any,
          color: theme.semantic.text.default,
          textTransform: "uppercase" as any,
          letterSpacing: 0.6
        },
        hint: {
          fontSize: theme.primitives.typography.caption.fontSize,
          color: theme.semantic.text.muted
        },
        success: {
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "800" as any,
          color: theme.semantic.state.success
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.primitives.spacing.xl
        }
      }),
    [theme]
  );

  if (status === "loading") {
    return (
      <View style={[{ flex: 1, backgroundColor: theme.semantic.color.screenBackground }, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.semantic.color.screenBackground }}
      contentContainerStyle={styles.scroll}
      testID="profile-step"
    >
      <Screen
        title="Tu perfil"
        description="Lo básico para arrancar. Después podés completar el resto."
      >
        <Stack>
          <RNText style={styles.fieldLabel}>Nombre</RNText>
          <TextField
            testID="profile-step-name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Cómo querés que te vean"
            autoCapitalize="words"
            maxLength={50}
          />

          <RNText style={styles.fieldLabel}>Fecha de nacimiento</RNText>
          <DatePickerField
            testID="profile-step-birthdate"
            value={birthDate || null}
            onChange={setBirthDate}
            maximumDate={maxBirthDate()}
            minimumDate={minBirthDate()}
            placeholder="Elegí tu fecha de nacimiento"
          />
          <RNText style={styles.hint}>Tenés que ser mayor de 18.</RNText>

          <RNText style={styles.fieldLabel}>Soy</RNText>
          <ChoiceGroup
            testID="profile-step-gender"
            options={GENDER_OPTIONS}
            value={gender}
            onChange={(v) => setGender(v)}
          />

          <RNText style={styles.fieldLabel}>Estoy buscando</RNText>
          <ChoiceGroup
            testID="profile-step-intent"
            options={INTENT_OPTIONS}
            value={intent}
            onChange={(v) => setIntent(v)}
            columns={2}
          />

          {savedAt && !error ? <RNText style={styles.success}>✓ Guardado</RNText> : null}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <SaveButton
            testID="profile-step-save"
            saving={status === "saving"}
            savedAt={savedAt}
            onPress={() => void handleSave()}
            label="Guardar y continuar"
          />
        </Stack>
      </Screen>
    </ScrollView>
  );
}
