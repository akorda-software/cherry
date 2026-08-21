import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";

import { refreshBootstrap } from "../../app-bootstrap/presentation/app-bootstrap-provider";
import { FormMessage, Screen, Stack, Surface, useTheme } from "../../../shared/ui";
import { SaveButton } from "./save-button";
import { TextField } from "./text-field";
import { useProfileApi } from "./use-profile-api";

const BIO_MIN = 20;
const BIO_MAX = 240;

type Status = "loading" | "ready" | "saving";

export function BioStepScreen() {
  const theme = useTheme();
  const router = useRouter();
  const callApi = useProfileApi();

  const [bio, setBio] = useState("");
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
          setBio(profile.bio ?? "");
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la bio");
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [callApi]);

  const trimmed = bio.trim();
  const charCount = trimmed.length;
  const charValid = charCount >= BIO_MIN && charCount <= BIO_MAX;

  const handleSave = useCallback(async () => {
    if (!charValid) {
      setError(`La bio tiene que tener entre ${BIO_MIN} y ${BIO_MAX} caracteres.`);
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await callApi((api) => api.updateProfile({ bio: trimmed }));
      await refreshBootstrap();
      setSavedAt(Date.now());
      setStatus("ready");
      router.replace("/(onboarding)/preferences");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      setStatus("ready");
    }
  }, [callApi, charValid, router, trimmed]);

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
        counter: {
          fontSize: theme.primitives.typography.caption.fontSize,
          fontWeight: "700" as any,
          color: charValid ? theme.semantic.text.muted : theme.semantic.state.danger,
          alignSelf: "flex-end"
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
        },
        photoPlaceholder: {
          padding: theme.primitives.spacing.lg,
          alignItems: "center",
          gap: theme.primitives.spacing.sm
        },
        photoPlaceholderText: {
          fontSize: theme.primitives.typography.caption.fontSize,
          color: theme.semantic.text.muted,
          textAlign: "center"
        }
      }),
    [charValid, theme]
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
      testID="bio-step"
    >
      <Screen title="Sobre vos" description="Una buena bio te ayuda a encontrar mejores matches.">
        <Stack>
          <RNText style={styles.fieldLabel}>Fotos</RNText>
          <Surface>
            <View style={styles.photoPlaceholder}>
              <RNText style={styles.photoPlaceholderText}>
                La subida de fotos se habilita en la próxima iteración.
              </RNText>
              <RNText style={styles.photoPlaceholderText}>
                Por ahora podés continuar con la bio y las vas a poder agregar después.
              </RNText>
            </View>
          </Surface>

          <RNText style={styles.fieldLabel}>Bio</RNText>
          <TextField
            testID="bio-step-input"
            value={bio}
            onChangeText={setBio}
            placeholder={`Entre ${BIO_MIN} y ${BIO_MAX} caracteres. Ej.: amo el café, los perros y el cine indie.`}
            multiline
            numberOfLines={4}
            maxLength={BIO_MAX}
          />
          <RNText style={styles.counter}>
            {charCount}/{BIO_MAX}
          </RNText>

          {savedAt && !error ? <RNText style={styles.success}>✓ Guardado</RNText> : null}
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <SaveButton
            testID="bio-step-save"
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
