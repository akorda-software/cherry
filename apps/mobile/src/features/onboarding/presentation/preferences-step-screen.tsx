import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";

import type { DiscoveryPreferences } from "@snack/contracts";

import { refreshBootstrap } from "../../app-bootstrap/presentation/app-bootstrap-provider";
import { FormMessage, Screen, Stack, useTheme } from "../../../shared/ui";
import { MultiChoiceGroup } from "./multi-choice-group";
import { SaveButton } from "./save-button";
import { TextField } from "./text-field";
import { useProfileApi } from "./use-profile-api";

type Interested = "men" | "women" | "non_binary";

type Status = "loading" | "ready" | "saving";

interface FormState {
  interested: Interested[];
  ageMin: string;
  ageMax: string;
  distanceKm: string;
}

const DEFAULT_FORM: FormState = {
  interested: [],
  ageMin: "18",
  ageMax: "99",
  distanceKm: "50"
};

const INTERESTED_OPTIONS: ReadonlyArray<{ value: Interested; label: string }> = [
  { value: "men", label: "Hombres" },
  { value: "women", label: "Mujeres" },
  { value: "non_binary", label: "No binario" }
];

function formFromPrefs(prefs: DiscoveryPreferences | null | undefined): FormState {
  if (!prefs) return { ...DEFAULT_FORM };

  const interested: Interested[] = [];
  if (prefs.showMen) interested.push("men");
  if (prefs.showWomen) interested.push("women");
  if (prefs.showNonBinary) interested.push("non_binary");

  return {
    interested,
    ageMin: String(prefs.ageMin ?? DEFAULT_FORM.ageMin),
    ageMax: String(prefs.ageMax ?? DEFAULT_FORM.ageMax),
    distanceKm: String(prefs.distanceKm ?? DEFAULT_FORM.distanceKm)
  };
}

export function PreferencesStepScreen() {
  const theme = useTheme();
  const router = useRouter();
  const callApi = useProfileApi();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const profileRes = await callApi((api) => api.getProfile().catch(() => null));
        const prefsRes = await callApi((api) => api.getDiscoveryPreferences().catch(() => null));
        if (cancelled) return;

        const prefsFromProfile = profileRes?.profile?.discoveryPreferences ?? null;
        const prefs = prefsRes?.discoveryPreferences ?? prefsFromProfile;
        setForm(formFromPrefs(prefs));
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar las preferencias");
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callApi]);

  const validationError = useMemo(() => {
    if (form.interested.length === 0) return "Elegí al menos una opción";
    const min = Number(form.ageMin);
    const max = Number(form.ageMax);
    const dist = Number(form.distanceKm);
    if (Number.isNaN(min) || min < 18) return "Edad mínima: 18 o más";
    if (Number.isNaN(max) || max > 120) return "Edad máxima inválida";
    if (min > max) return "La edad mínima no puede ser mayor que la máxima";
    if (Number.isNaN(dist) || dist < 1) return "Distancia inválida";
    return null;
  }, [form]);

  const handleSave = useCallback(async () => {
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await callApi((api) =>
        api.updateDiscoveryPreferences({
          showMen: form.interested.includes("men"),
          showWomen: form.interested.includes("women"),
          showNonBinary: form.interested.includes("non_binary"),
          ageMin: Number(form.ageMin),
          ageMax: Number(form.ageMax),
          distanceKm: Number(form.distanceKm)
        })
      );
      await refreshBootstrap();
      setSavedAt(Date.now());
      setStatus("ready");
      router.replace("/(onboarding)/tags");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setStatus("ready");
    }
  }, [callApi, form, router, validationError]);

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
        row: {
          flexDirection: "row",
          gap: theme.primitives.spacing.sm
        },
        grow: { flexGrow: 1 },
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
      testID="preferences-step"
    >
      <Screen title="Tus preferencias" description="¿Quién querés conocer y a qué distancia?">
        <Stack>
          <RNText style={styles.fieldLabel}>Me interesa conocer</RNText>
          <MultiChoiceGroup
            testID="preferences-step-interested"
            options={INTERESTED_OPTIONS}
            values={form.interested}
            onChange={(values) => setForm((prev) => ({ ...prev, interested: values }))}
          />
          <RNText style={styles.hint}>Podés elegir uno, dos o los tres.</RNText>

          <RNText style={styles.fieldLabel}>Edad</RNText>
          <View style={styles.row}>
            <View style={styles.grow}>
              <RNText style={styles.hint}>Mínima</RNText>
              <TextField
                testID="preferences-step-age-min"
                value={form.ageMin}
                onChangeText={(v) => setForm((prev) => ({ ...prev, ageMin: v }))}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
            <View style={styles.grow}>
              <RNText style={styles.hint}>Máxima</RNText>
              <TextField
                testID="preferences-step-age-max"
                value={form.ageMax}
                onChangeText={(v) => setForm((prev) => ({ ...prev, ageMax: v }))}
                keyboardType="numeric"
                maxLength={3}
              />
            </View>
          </View>

          <RNText style={styles.fieldLabel}>Distancia máxima (km)</RNText>
          <TextField
            testID="preferences-step-distance"
            value={form.distanceKm}
            onChangeText={(v) => setForm((prev) => ({ ...prev, distanceKm: v }))}
            keyboardType="numeric"
            maxLength={5}
          />

          {savedAt && !error ? <RNText style={styles.success}>✓ Guardado</RNText> : null}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <SaveButton
            testID="preferences-step-save"
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
