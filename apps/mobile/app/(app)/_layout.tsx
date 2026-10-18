import type { PropsWithChildren } from "react";
import { Redirect, Stack, usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";

import { refreshBootstrap, useAppBootstrap } from "../../src/features/app-bootstrap";
import { AppOverlays } from "../../src/features/app-overlays";
import { useSessionShell } from "../../src/features/auth/presentation";
import { optionalStackScreens } from "../../src/features/optional-modules";
import { needsLegalAcceptance } from "../../src/features/legal/domain/legal";
import { LegalScreen } from "../../src/features/legal/presentation/legal-screen";
import { appShellRoutes, ErrorState, LoadingScreen, Screen, useTheme } from "../../src/shared/ui";

function PrivateGuard({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { state } = useSessionShell();
  const { state: bootstrapState } = useAppBootstrap();

  if (state.status === "loading") {
    return <LoadingScreen testID="private-loading" />;
  }

  if (state.status === "signed-out") {
    return <Redirect href={appShellRoutes.login} />;
  }

  // Support and privacy do not require a complete profile, age verification or a healthy social bootstrap.
  if (["/support", appShellRoutes.support, "/settings", appShellRoutes.settings, "/auth-methods", appShellRoutes.authMethods, "/about", appShellRoutes.about, "/legal", appShellRoutes.legal].includes(pathname)) return <>{children}</>;

  if (bootstrapState.status === "loading" || bootstrapState.status === "idle") {
    return <LoadingScreen testID="private-loading" />;
  }

  if (bootstrapState.status === "error") {
    return (
      <Screen>
        <ErrorState
          message="No hemos podido cargar tu cuenta. Revisa tu conexión y vuelve a intentarlo."
          onRetry={() => void refreshBootstrap()}
          testID="private-error"
        />
      </Screen>
    );
  }

  if (needsLegalAcceptance(bootstrapState.bootstrap.legal)) return <LegalScreen gate />;

  if (bootstrapState.bootstrap.profile.onboardingRequired) {
    return <Redirect href={appShellRoutes.onboarding} />;
  }

  return <>{children}</>;
}

/**
 * Zona privada: guard de sesión/onboarding + overlays globales montados una
 * vez encima de la navegación. Cada pantalla trae su propia cabecera (`TopBar`).
 */
export function PrivateLayout({ children }: PropsWithChildren) {
  return (
    <PrivateGuard>
      <View style={styles.root}>
        {children}
        <AppOverlays />
      </View>
    </PrivateGuard>
  );
}

export default function PrivateLayoutRoute() {
  const theme = useTheme();

  return (
    <PrivateLayout>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.semantic.color.screenBackground }
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Sube desde abajo: continúa el gesto de deslizar la card hacia arriba (Descubrir). */}
        <Stack.Screen name="profile/[id]" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="filters" options={{ presentation: "modal" }} />
        <Stack.Screen name="edit/photos" />
        <Stack.Screen name="edit/tags" />
        <Stack.Screen name="edit/bio" />
        <Stack.Screen name="edit/basics" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="auth-methods" />
        <Stack.Screen name="support" />
        <Stack.Screen name="legal" />
        <Stack.Screen name="about" />
        <Stack.Screen name="verify/index" />
        <Stack.Screen name="verify/methods" />
        <Stack.Screen name="verify/document" />
        <Stack.Screen name="verify/selfie" />
        {optionalStackScreens.map((screen) => (
          <Stack.Screen key={screen.name} name={screen.name} options={{ title: screen.title }} />
        ))}
      </Stack>
    </PrivateLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
