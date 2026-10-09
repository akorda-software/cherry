import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormMessage, Logo, Mascot, PaperBackground, PopIn, Surface, Text, useTheme } from "../../../shared/ui";
import { AuthActionList } from "./auth-action-list";
import { useSessionShell } from "./session-shell-provider";

/** Tras entrar, `app/index.tsx` espera al bootstrap y decide: onboarding o Descubrir. */
const afterSignInPath = "/";

/**
 * Bienvenida: lo primero que ve cualquiera. Logo, la mascota y una línea que dice qué es;
 * abajo, los proveedores (más los atajos de pruebas en desarrollo). Sin eslóganes.
 */
export function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { state, signInWith, signInAsTest } = useSessionShell();

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(afterSignInPath);
    }
  }, [router, state.status]);

  const busyProvider = state.status === "signed-out" ? state.busyProvider : null;
  const error = state.status === "signed-out" ? state.error : null;

  return (
    <View style={styles.root} testID="login-screen">
      <PaperBackground />
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + theme.primitives.spacing.md,
            paddingBottom: insets.bottom + theme.primitives.spacing.lg,
            paddingLeft: insets.left + theme.semantic.layout.screenPadding,
            paddingRight: insets.right + theme.semantic.layout.screenPadding
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <View style={styles.hero}>
            <PopIn fromScale={0.85} rotate={-4}>
              <Logo fill="fresa" height={64} />
            </PopIn>
            <PopIn delay={120} fromScale={0.8} style={styles.mascot}>
              <Mascot animated mood="love" size={148} />
            </PopIn>
            <Text align="center" aria-level={1} role="heading" variant="title1">
              {"Conoce gente\ncerca de ti."}
            </Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.actions}>
            {error ? (
              <Surface border="regular" color="tomate" elevation="none" padding="sm" radius="md" soft>
                <FormMessage tone="error">{error}</FormMessage>
              </Surface>
            ) : null}
            <AuthActionList
              busyProvider={busyProvider}
              onSelect={(provider) => void signInWith(provider)}
              onTest={signInAsTest ? (email) => void signInAsTest(email) : undefined}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    flexGrow: 1
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center"
  },
  hero: {
    alignItems: "center",
    gap: 4
  },
  mascot: {
    marginVertical: 8
  },
  spacer: {
    flexGrow: 1,
    minHeight: 28
  },
  actions: {
    gap: 14
  }
});

export default LoginScreen;
