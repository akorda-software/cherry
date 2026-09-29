import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Deco,
  FormMessage,
  Icon,
  type IconName,
  Logo,
  Mascot,
  PaperBackground,
  type PastelName,
  PopIn,
  Sticker,
  stagger,
  Surface,
  Text,
  useTheme,
  WashiTape,
  Wiggle
} from "../../../shared/ui";
import { AuthActionList } from "./auth-action-list";
import { useSessionShell } from "./session-shell-provider";

/** Tras entrar, `app/index.tsx` espera al bootstrap y decide: onboarding o Descubrir. */
const afterSignInPath = "/";

interface WelcomePromise {
  icon: IconName;
  text: string;
  color: PastelName;
  rotate: number;
  align: "flex-start" | "center" | "flex-end";
  tape?: boolean;
}

const promises: readonly WelcomePromise[] = [
  { icon: "gift", text: "Gratis. Para siempre.", color: "limonada", rotate: -3, align: "flex-start", tape: true },
  { icon: "heart", text: "Sin muros de pago", color: "menta", rotate: 2.5, align: "flex-end" },
  { icon: "code", text: "Código abierto", color: "cielo", rotate: -1.5, align: "center" }
];

/** Retardo del primer «pegado» de las promesas: después de que Mochi salude. */
const PROMISES_DELAY = 380;

/**
 * Bienvenida: lo primero que ve cualquiera. Mochi saluda, las promesas se pegan como
 * pegatinas y abajo quedan los proveedores (más los atajos de pruebas en desarrollo).
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
      <PaperBackground tone="lavanda" />
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
            <HelloMochi />
            <Text align="center" aria-level={1} role="heading" variant="hero">
              {"Ligar\nsin trucos."}
            </Text>
          </View>

          <View accessibilityRole="list" style={styles.promises}>
            {promises.map((promise, index) => (
              <PopIn
                delay={stagger(index, 90, PROMISES_DELAY)}
                fromScale={0.7}
                key={promise.text}
                rotate={promise.rotate}
                style={{ alignSelf: promise.align }}
              >
                <View>
                  <Sticker color={promise.color} padding={{ x: 14, y: 8 }}>
                    <View style={styles.promiseRow}>
                      <Icon fill={theme.primitives.color.white} name={promise.icon} size={20} />
                      <Text variant="label">{promise.text}</Text>
                    </View>
                  </Sticker>
                  {promise.tape ? (
                    <WashiTape color="fresa" height={18} pattern="stripes" rotation={-28} style={styles.tape} width={52} />
                  ) : null}
                </View>
              </PopIn>
            ))}
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

/** Mochi aparece, se asienta y saluda con un meneo (una vez). */
function HelloMochi() {
  const [hello, setHello] = useState<number | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setHello(1), 520);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.mochi}
    >
      <Deco color="limonada" kind="sparkle" size={26} style={styles.sparkleLeft} />
      <Deco color="fresa" kind="heart" rotation={14} size={20} style={styles.heartRight} />
      <Deco color="cielo" kind="star" rotation={-10} size={16} style={styles.starRight} />
      <PopIn delay={120} fromScale={0.8}>
        <Wiggle amplitude={7} trigger={hello}>
          <Mascot animated mood="happy" size={132} />
        </Wiggle>
      </PopIn>
      <PopIn delay={640} fromScale={0.7} rotate={-8} style={styles.hola}>
        <Text variant="hand">¡hola!</Text>
      </PopIn>
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
  mochi: {
    width: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2
  },
  sparkleLeft: {
    position: "absolute",
    top: 16,
    left: 22
  },
  heartRight: {
    position: "absolute",
    top: 38,
    right: 30
  },
  starRight: {
    position: "absolute",
    bottom: 26,
    right: 22
  },
  hola: {
    position: "absolute",
    top: 8,
    right: 14
  },
  promises: {
    marginTop: 18,
    gap: 8,
    paddingHorizontal: 6
  },
  promiseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  tape: {
    position: "absolute",
    top: -9,
    left: -14
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
