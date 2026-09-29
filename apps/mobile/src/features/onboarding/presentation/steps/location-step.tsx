import { useCallback, useEffect, useRef } from "react";
import { AppState, StyleSheet, View } from "react-native";

import type { LocationUpdateRequest } from "@snack/contracts";

import { Button, FormMessage, Icon, Mascot, type MascotMood, Stack, Surface, Text, useTheme } from "../../../../shared/ui";
import { useShareLocation, type ShareLocationStatus } from "../../../location/application/use-share-location";
import { expoLocationService } from "../../../location/infrastructure/expo-location-service";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { useStepCta } from "../../application/step-cta-store";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";

const MOODS: Record<ShareLocationStatus, MascotMood> = {
  idle: "happy",
  working: "thinking",
  saved: "love",
  denied: "sad",
  blocked: "sad",
  unavailable: "surprised",
  error: "sad"
};

function subscribeToForeground(listener: () => void) {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") listener();
  });
  return () => subscription.remove();
}

/**
 * Paso 10: ubicación aproximada. Explica la privacidad antes de pedir el
 * permiso; si se deniega para siempre, lleva a Ajustes y reintenta sola al volver.
 */
export function LocationStep() {
  const theme = useTheme();
  const { profile, ready, callApi } = useProfileDraft();
  const navigation = useOnboardingNavigation();
  const send = useCallback(
    (request: LocationUpdateRequest) => callApi((api) => api.updateLocation(request)),
    [callApi]
  );
  const location = useShareLocation({ service: expoLocationService, send, subscribeToForeground });
  const advanced = useRef(false);
  const hasLocation = profile?.hasLocation === true;

  useEffect(() => {
    if (location.status !== "saved" || advanced.current) {
      return undefined;
    }

    advanced.current = true;
    useProfileDraftStore.getState().patchProfile({ hasLocation: true });
    // Un instante para ver a Mochi contento antes de pasar página.
    const timer = setTimeout(() => navigation.goNext("location"), 650);
    return () => clearTimeout(timer);
  }, [location.status, navigation]);

  const status = location.status;
  const blocked = status === "blocked";
  const failedOnce = status === "denied" || status === "unavailable" || status === "error";

  useStepCta("location", {
    enabled: ready && status !== "saved",
    busy: status === "working",
    label: blocked
      ? "Abrir Ajustes"
      : failedOnce
        ? "Intentarlo otra vez"
        : hasLocation && status === "idle"
          ? "Continuar"
          : "Compartir mi ubicación",
    secondary: blocked ? { label: "Ya está", onPress: () => void location.share(), testID: "onboarding-location-retry" } : null,
    onPress: () => {
      if (blocked) {
        void location.openSettings();
      } else if (hasLocation && status === "idle") {
        navigation.goNext("location");
      } else {
        void location.share();
      }
    }
  });

  return (
    <StepPage
      step="location"
      subtitle="Así te enseñamos gente de tu zona y la distancia aproximada a la que está."
      testID="onboarding-step-location"
      title="¿Por dónde andas?"
    >
      <Stack gap="lg">
        <View style={styles.mascot}>
          <Mascot animated color="menta" mood={MOODS[status]} size={132} />
        </View>

        <Surface elevation="sm" padding="md" radius="md">
          <View style={styles.privacy}>
            <View style={[styles.privacyIcon, { backgroundColor: theme.primitives.pastel.menta.soft, borderColor: theme.primitives.color.ink }]}>
              <Icon color={theme.primitives.color.ink} name="shield-check" size={24} />
            </View>
            <Stack flex gap={4}>
              <Text variant="bodyStrong">Redondeamos tu ubicación a 500 m.</Text>
              <Text color="muted" variant="callout">
                Nunca compartimos la exacta: los demás solo ven una distancia aproximada.
              </Text>
            </Stack>
          </View>
        </Surface>

        {status === "saved" ? (
          <FormMessage tone="success">¡Listo! Ya sabemos por dónde andas.</FormMessage>
        ) : location.message ? (
          <FormMessage tone={blocked || failedOnce ? "error" : "info"}>{location.message}</FormMessage>
        ) : hasLocation ? (
          <FormMessage tone="success">Ya tenemos tu zona. Puedes seguir o actualizarla.</FormMessage>
        ) : null}

        {hasLocation && status === "idle" ? (
          <Button icon="refresh" onPress={() => void location.share()} testID="onboarding-location-update" variant="ghost">
            Actualizar mi ubicación
          </Button>
        ) : null}
      </Stack>
    </StepPage>
  );
}

const styles = StyleSheet.create({
  mascot: {
    alignItems: "center",
    paddingVertical: 4
  },
  privacy: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start"
  },
  privacyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center"
  }
});
