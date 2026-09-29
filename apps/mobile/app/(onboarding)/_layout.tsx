import { useRef } from "react";
import { Redirect, Stack } from "expo-router";
import { useReducedMotion } from "react-native-reanimated";

import { refreshBootstrap, useAppBootstrap } from "../../src/features/app-bootstrap";
import { useSessionShell } from "../../src/features/auth/presentation";
import { OnboardingFrame } from "../../src/features/onboarding";
import { appShellRoutes, ErrorState, LoadingScreen, Screen, useTheme } from "../../src/shared/ui";

/**
 * Onboarding: guard de sesión + marco común (progreso, atrás y CTA fija) sobre
 * una pila nativa (gesto atrás de iOS y botón atrás de Android incluidos).
 * El guard solo decide al entrar: los refrescos del bootstrap a mitad del flujo
 * no desmontan la pila.
 */
export default function OnboardingLayoutRoute() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const { state: session } = useSessionShell();
  const { state: bootstrap } = useAppBootstrap();
  const entry = useRef<"onboarding" | "exit" | null>(null);

  if (session.status === "loading") {
    return <LoadingScreen testID="onboarding-loading" />;
  }

  if (session.status === "signed-out") {
    return <Redirect href={appShellRoutes.login} />;
  }

  if (entry.current === null && bootstrap.status === "ready") {
    const profile = bootstrap.bootstrap.profile;
    // Sin campos pendientes pero sin confirmar (`isDiscoverable` falso) aún hay
    // que pasar por «done»: solo se sale si el perfil está publicado o en pausa.
    const finished = !profile.onboardingRequired && (profile.isDiscoverable || profile.isPaused);
    entry.current = finished ? "exit" : "onboarding";
  }

  if (entry.current === null) {
    if (bootstrap.status === "error") {
      return (
        <Screen>
          <ErrorState
            message="No hemos podido cargar tu cuenta. Revisa tu conexión y vuelve a intentarlo."
            onRetry={() => void refreshBootstrap()}
            testID="onboarding-bootstrap-error"
          />
        </Screen>
      );
    }

    return <LoadingScreen testID="onboarding-loading" />;
  }

  if (entry.current === "exit") {
    return <Redirect href={appShellRoutes.discover} />;
  }

  return (
    <OnboardingFrame>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? "fade" : "slide_from_right",
          contentStyle: { backgroundColor: theme.semantic.color.screenBackground },
          gestureEnabled: true
        }}
      >
        <Stack.Screen name="index" options={{ animation: "none" }} />
        <Stack.Screen name="done" options={{ gestureEnabled: false }} />
      </Stack>
    </OnboardingFrame>
  );
}
