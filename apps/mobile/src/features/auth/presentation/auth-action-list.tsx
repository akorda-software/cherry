import { type ReactNode, useState } from "react";
import type { AuthProvider } from "@snack/mobile-shared";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Button, Icon, LoadingDots, PressableScale, Text, useTheme } from "../../../shared/ui";
import type { BusyProvider } from "./session-store";

/** Persona de demo del seed del backend: perfil completo con likes, matches y chats. */
export const DEMO_TEST_EMAIL = "demo@snack.dev";

/** Segunda persona de demo (Hugo, sin interacciones): para probar matches en directo entre dos sesiones. */
export const DEMO2_TEST_EMAIL = "demo2@snack.dev";

/** Email desechable para estrenar un usuario de pruebas (entra al onboarding desde cero). */
export function createFreshTestEmail(now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `nuevo-${now.toString(36)}-${suffix}@snack.dev`;
}

/**
 * Colores de marca de terceros, no del tema: Apple solo admite su botón en negro o blanco,
 * sin adornos (ni sombras de color ni giros), y Google su «G» de cuatro colores sobre blanco
 * (guías de Sign in with Apple / Google).
 */
const providerBrand = {
  appleFill: "#000000",
  appleInk: "#FFFFFF"
} as const;

const providerNames: Record<AuthProvider, string> = { google: "Google", apple: "Apple" };

interface AuthActionListProps {
  busyProvider: BusyProvider | null;
  onSelect(provider: AuthProvider): void;
  /** Solo en desarrollo: login de pruebas (sin email = usuario de test compartido). */
  onTest?(email?: string): void;
  /**
   * «Continuar con Apple»: por defecto solo en iOS, el único sitio con Sign in with Apple
   * nativo (en Android y en web no hay flujo soportado).
   */
  showApple?: boolean;
}

export function AuthActionList({
  busyProvider,
  onSelect,
  onTest,
  showApple = Platform.OS === "ios"
}: AuthActionListProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const locked = busyProvider !== null;

  return (
    <View style={styles.list}>
      <ProviderButton
        busy={busyProvider === "google"}
        colors={{ fill: c.white, border: c.ink, text: c.ink, shadow: c.ink }}
        disabled={locked}
        logo={<GoogleLogo size={22} />}
        onPress={() => onSelect("google")}
        provider="google"
        testID="login-google"
      />
      {showApple ? (
        <ProviderButton
          busy={busyProvider === "apple"}
          colors={{
            fill: providerBrand.appleFill,
            border: providerBrand.appleFill,
            text: providerBrand.appleInk,
            shadow: null
          }}
          disabled={locked}
          logo={<AppleLogo color={providerBrand.appleInk} size={22} />}
          onPress={() => onSelect("apple")}
          provider="apple"
          testID="login-apple"
        />
      ) : null}
      {/* `__DEV__` literal: el empaquetador lo sustituye y elimina este bloque en producción. */}
      {__DEV__ && onTest ? (
        <DevSignIn busy={busyProvider === "test"} disabled={locked} onTest={onTest} />
      ) : null}
    </View>
  );
}

interface ProviderButtonProps {
  provider: AuthProvider;
  logo: ReactNode;
  /** `shadow: null` = botón limpio, sin sombra ni hundimiento (Apple). */
  colors: { fill: string; border: string; text: string; shadow: string | null };
  busy: boolean;
  disabled: boolean;
  onPress(): void;
  testID: string;
}

/** Botón de proveedor como pegatina: contorno, sombra dura y se hunde al pulsar. */
function ProviderButton({ provider, logo, colors, busy, disabled, onPress, testID }: ProviderButtonProps) {
  const theme = useTheme();
  const label = `Continuar con ${providerNames[provider]}`;
  const blocked = busy || disabled;

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy }}
      aria-busy={busy || undefined}
      disabled={blocked}
      elevation={colors.shadow ? "md" : "none"}
      faceStyle={[
        styles.providerFace,
        {
          backgroundColor: colors.fill,
          borderColor: colors.border,
          borderWidth: theme.primitives.border.bold,
          borderRadius: theme.primitives.radius.pill
        }
      ]}
      haptic
      onPress={onPress}
      pressedScale={colors.shadow ? 1 : 0.98}
      shadowColor={colors.shadow ?? undefined}
      style={disabled && !busy ? { opacity: theme.primitives.opacity.disabled } : null}
      testID={testID}
    >
      <View style={[styles.providerRow, { opacity: busy ? 0 : 1 }]}>
        {logo}
        <Text adjustsFontSizeToFit color={colors.text} minimumFontScale={0.85} numberOfLines={1} variant="button">
          {label}
        </Text>
      </View>
      {busy ? (
        <View style={styles.providerLoading}>
          <LoadingDots accessibilityLabel={`Entrando con ${providerNames[provider]}…`} color={colors.text} size={8} />
        </View>
      ) : null}
    </PressableScale>
  );
}

interface DevSignInProps {
  busy: boolean;
  disabled: boolean;
  onTest(email?: string): void;
}

/** Atajos de desarrollo: nunca salen en una build de producción. */
function DevSignIn({ busy, disabled, onTest }: DevSignInProps) {
  const theme = useTheme();
  const [choice, setChoice] = useState<"new" | "demo" | "demo2" | null>(null);

  function start(next: "new" | "demo" | "demo2") {
    setChoice(next);
    onTest(next === "new" ? createFreshTestEmail() : next === "demo" ? DEMO_TEST_EMAIL : DEMO2_TEST_EMAIL);
  }

  return (
    <View
      style={[
        styles.devBox,
        {
          borderColor: theme.primitives.color.inkFaint,
          borderWidth: theme.primitives.border.thin,
          borderRadius: theme.primitives.radius.md
        }
      ]}
      testID="login-dev-tools"
    >
      <View style={styles.devTitle}>
        <Icon color={theme.semantic.text.muted} name="code" size={16} />
        <Text color="muted" variant="caption">
          Solo en desarrollo
        </Text>
      </View>
      <Button
        color="menta"
        disabled={disabled && !(busy && choice === "new")}
        fullWidth
        icon="sparkle"
        loading={busy && choice === "new"}
        onPress={() => start("new")}
        size="sm"
        testID="login-dev-new"
        variant="soft"
      >
        Entrar como usuario nuevo
      </Button>
      <Button
        color="cielo"
        disabled={disabled && !(busy && choice === "demo")}
        fullWidth
        icon="user"
        loading={busy && choice === "demo"}
        onPress={() => start("demo")}
        size="sm"
        testID="login-dev-demo"
        variant="soft"
      >
        Entrar como Lucía (demo)
      </Button>
      <Button
        color="lavanda"
        disabled={disabled && !(busy && choice === "demo2")}
        fullWidth
        icon="user"
        loading={busy && choice === "demo2"}
        onPress={() => start("demo2")}
        size="sm"
        testID="login-dev-demo2"
        variant="soft"
      >
        Entrar como Hugo (demo 2)
      </Button>
    </View>
  );
}

/** «G» oficial de Google a cuatro colores (no se recolorea nunca). */
function GoogleLogo({ size }: { size: number }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants">
      <Svg height={size} viewBox="0 0 48 48" width={size}>
        <Path
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
          fill="#4285F4"
        />
        <Path
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
          fill="#34A853"
        />
        <Path
          d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
          fill="#FBBC04"
        />
        <Path
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
          fill="#EA4335"
        />
      </Svg>
    </View>
  );
}

function AppleLogo({ size, color }: { size: number; color: string }) {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants">
      <Svg height={size} viewBox="0 0 24 24" width={size}>
        <Path
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14
  },
  providerFace: {
    minHeight: 58,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  providerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  devBox: {
    borderStyle: "dashed",
    padding: 12,
    gap: 10,
    marginTop: 4
  },
  devTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  }
});
