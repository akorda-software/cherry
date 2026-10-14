import { useEffect } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { CherryMark, easings, FormMessage, Text, useTheme } from "../../../shared/ui";
import { withAlpha } from "../../../shared/ui/utils/color";
import { AuthActionList } from "./auth-action-list";
import { useSessionShell } from "./session-shell-provider";

/** Tras entrar, `app/index.tsx` espera al bootstrap y decide: onboarding o Descubrir. */
const afterSignInPath = "/";

const MARK_SIZE = 124;
const GLOW_SIZE = 380;

/** Luz suave detrás de las cerezas: un degradado radial de blanco a transparente, sin bordes. */
function Glow({ color }: { color: string }) {
  const r = GLOW_SIZE / 2;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.glow}>
      <Svg height={GLOW_SIZE} width={GLOW_SIZE}>
        <Defs>
          <RadialGradient cx={r} cy={r} gradientUnits="userSpaceOnUse" id="login-glow" r={r}>
            <Stop offset="0" stopColor={color} stopOpacity={0.5} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.18} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} fill="url(#login-glow)" r={r} />
      </Svg>
    </View>
  );
}

/**
 * Bienvenida: lo primero que ve cualquiera. Arriba, sobre el amarillo de marca, el logo, el nombre
 * y una línea que dice qué es; abajo, en una hoja blanca, los proveedores (más los atajos de pruebas
 * en desarrollo). Esta pantalla no lleva el neobrutalismo del resto: sin contornos de tinta ni
 * sombras duras, solo sombras suaves y mucho aire.
 */
export function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const c = theme.primitives.color;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { state, signInWith, signInAsTest } = useSessionShell();

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(afterSignInPath);
    }
  }, [router, state.status]);

  // La hoja de los botones sube un poco al aparecer (nada con «reducir movimiento»).
  const rise = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) {
      rise.value = withDelay(80, withTiming(1, { duration: 420, easing: easings.out }));
    }
  }, [reduced, rise]);
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + rise.value * 0.6,
    transform: [{ translateY: (1 - rise.value) * 24 }]
  }));

  const busyProvider = state.status === "signed-out" ? state.busyProvider : null;
  const error = state.status === "signed-out" ? state.error : null;

  return (
    <View style={[styles.root, { backgroundColor: c.limonada }]} testID="login-screen">
      <LinearGradient
        colors={[c.limonada, c.limonada, c.limonadaSoft] as const}
        locations={[0, 0.45, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + theme.primitives.spacing.xl,
              paddingLeft: insets.left + theme.semantic.layout.screenPadding,
              paddingRight: insets.right + theme.semantic.layout.screenPadding
            }
          ]}
        >
          <View style={styles.markWrap}>
            <Glow color={c.white} />
            <CherryMark decorative size={MARK_SIZE} />
          </View>
          <RNText
            allowFontScaling={false}
            style={[styles.wordmark, { color: c.ink, fontFamily: theme.primitives.fonts.display }]}
          >
            cherry
          </RNText>
          <Text
            align="center"
            aria-level={1}
            role="heading"
            style={[styles.tagline, { fontFamily: theme.primitives.fonts.medium }]}
            variant="body"
          >
            Conoce gente cerca de ti.
          </Text>
        </View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.white,
              boxShadow: `0 -6px 30px ${withAlpha(c.ink, 0.08)}`,
              paddingBottom: insets.bottom + theme.primitives.spacing.lg,
              paddingLeft: insets.left + theme.semantic.layout.screenPadding,
              paddingRight: insets.right + theme.semantic.layout.screenPadding
            },
            sheetStyle
          ]}
        >
          <View style={styles.column}>
            <Text align="center" color="muted" variant="callout">
              Entra o crea tu cuenta
            </Text>
            {error ? (
              <View style={[styles.error, { backgroundColor: c.tomateSoft }]}>
                <FormMessage tone="error">{error}</FormMessage>
              </View>
            ) : null}
            <AuthActionList
              busyProvider={busyProvider}
              onSelect={(provider) => void signInWith(provider)}
              onTest={signInAsTest ? (email) => void signInAsTest(email) : undefined}
            />
          </View>
        </Animated.View>
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
  hero: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
    minHeight: 340
  },
  markWrap: {
    width: 240,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  glow: {
    position: "absolute",
    left: (240 - GLOW_SIZE) / 2,
    top: (160 - GLOW_SIZE) / 2
  },
  wordmark: {
    fontSize: 52,
    lineHeight: 62,
    letterSpacing: -2,
    textAlign: "center"
  },
  tagline: {
    marginTop: 4,
    maxWidth: 320,
    fontSize: 18,
    lineHeight: 25
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 28
  },
  column: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    gap: 16
  },
  error: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12
  }
});

export default LoginScreen;
