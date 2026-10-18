import { type ReactNode, useEffect, useState } from "react";
import type { AuthProvider } from "@cherry/mobile-shared";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text as RNText, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { appShellRoutes, Button, FormMessage, Mascot, Text, useTheme } from "../../../shared/ui";
import { withAlpha } from "../../../shared/ui/utils/color";
import { AuthActionList, defaultAppleAvailability } from "./auth-action-list";
import { LoginBackdrop } from "./login-backdrop";
import { LOGIN_STAGGER_MS, Rise } from "./login-entrance";
import { useSessionShell } from "./session-shell-provider";

/** Tras entrar, `app/index.tsx` espera al bootstrap y decide: onboarding o Descubrir. */
const afterSignInPath = "/";

const MARK_SIZE = 148;
const GLOW_SIZE = 380;

/** Retardos de la entrada escalonada: logo → nombre → frase → «Entra o crea tu cuenta» → botones. */
const enter = (step: number) => 60 + step * LOGIN_STAGGER_MS;

/**
 * Luz suave detrás de Mochi: un degradado radial de blanco a transparente, sin bordes, que respira
 * muy despacio (crece y se aviva un poco). Quieta con «reducir movimiento».
 */
function Glow({ color, still }: { color: string; still: boolean }) {
  const r = GLOW_SIZE / 2;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
    return () => cancelAnimation(breath);
  }, [breath, still]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.8 + breath.value * 0.2,
    transform: [{ scale: 0.96 + breath.value * 0.06 }]
  }));

  return (
    <Animated.View
      aria-hidden
      collapsable={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.glow, style]}
    >
      <Svg height={GLOW_SIZE} width={GLOW_SIZE}>
        <Defs>
          <RadialGradient cx={r} cy={r} gradientUnits="userSpaceOnUse" id="login-glow" r={r}>
            <Stop offset="0" stopColor={color} stopOpacity={0.45} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.14} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} fill="url(#login-glow)" r={r} />
      </Svg>
    </Animated.View>
  );
}

/** Mochi flota arriba y abajo, apenas unos puntos, como si estuviera suspendida en la luz. */
function Floating({ children, still }: { children: ReactNode; still: boolean }) {
  const float = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(float);
      float.value = 0;
      return;
    }
    float.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      )
    );
    return () => cancelAnimation(float);
  }, [float, still]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * float.value }] }));

  return (
    <Animated.View collapsable={false} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Bienvenida: lo primero que ve cualquiera. Todo sobre el mismo amarillo de marca: Mochi enamorada
 * con una luz suave detrás, el nombre, una línea que dice qué es y, debajo, los proveedores (más los
 * atajos de pruebas en desarrollo), sin hoja ni tarjeta. Por detrás suben muy despacio corazones y
 * cerecitas tenues, y cada pieza entra escalonada. Esta pantalla no lleva el neobrutalismo del
 * resto: sin contornos de tinta ni sombras duras. Con «reducir movimiento», todo quieto.
 */
export function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const c = theme.primitives.color;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { state, signInWith, signInAsTest } = useSessionShell();
  const [linkAfterLogin, setLinkAfterLogin] = useState<AuthProvider | null>(null);

  useEffect(() => {
    if (state.status === "signed-in") {
      router.replace(linkAfterLogin ? appShellRoutes.authMethods : afterSignInPath);
    }
  }, [router, state.status, linkAfterLogin]);

  const busyProvider = state.status === "signed-out" ? state.busyProvider : null;
  const error = state.status === "signed-out" ? state.error : null;
  const conflict = state.status === "signed-out" ? state.conflictProvider : null;
  const otherProvider = conflict === "apple" ? "google" : "apple";
  const providerName = { google: "Google", apple: "Apple" };
  const sidePadding = {
    paddingLeft: insets.left + theme.semantic.layout.screenPadding,
    paddingRight: insets.right + theme.semantic.layout.screenPadding
  };

  return (
    <View style={[styles.root, { backgroundColor: c.limonada }]} testID="login-screen">
      <LoginBackdrop />
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, sidePadding, { paddingTop: insets.top + theme.primitives.spacing.xl }]}>
          <View style={styles.markWrap}>
            <Glow color={c.white} still={reduced} />
            <Rise delay={enter(0)} distance={8} grow>
              <Floating still={reduced}>
                <Mascot animated mood="love" size={MARK_SIZE} />
              </Floating>
            </Rise>
          </View>
          <Rise delay={enter(1)}>
            <RNText
              allowFontScaling={false}
              style={[styles.wordmark, { color: c.ink, fontFamily: theme.primitives.fonts.display }]}
            >
              cherry
            </RNText>
          </Rise>
          <Rise delay={enter(2)}>
            <Text
              align="center"
              aria-level={1}
              role="heading"
              style={[styles.tagline, { fontFamily: theme.primitives.fonts.medium }]}
              variant="body"
            >
              Conoce gente cerca de ti.
            </Text>
          </Rise>
        </View>

        <View style={[styles.actions, sidePadding, { paddingBottom: insets.bottom + theme.primitives.spacing.lg }]}>
          <View style={styles.column}>
            <Rise delay={enter(3)} distance={8}>
              <RNText style={[styles.prompt, { color: withAlpha(c.ink, 0.72), fontFamily: theme.primitives.fonts.medium }]}>
                Entra o crea tu cuenta
              </RNText>
            </Rise>
            {error ? (
              <View style={[styles.error, { backgroundColor: withAlpha(c.white, 0.7) }]}>
                 <FormMessage tone="error">{error}</FormMessage>
                 {conflict ? <>
                   <Text>Entra primero con tu método habitual. Después podrás vincular ambos accesos sin crear otro perfil.</Text>
                   {otherProvider !== "apple" || defaultAppleAvailability() === "enabled" ?
                     <Button disabled={busyProvider !== null} variant="secondary" onPress={() => {
                       setLinkAfterLogin(conflict);
                       void signInWith(otherProvider);
                     }}>{`Entrar con ${providerName[otherProvider]} para vincular ${providerName[conflict]}`}</Button> : null}
                 </> : null}
              </View>
            ) : null}
            <AuthActionList
              busyProvider={busyProvider}
              entranceDelay={enter(4)}
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
  actions: {
    paddingTop: 8
  },
  prompt: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center"
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
