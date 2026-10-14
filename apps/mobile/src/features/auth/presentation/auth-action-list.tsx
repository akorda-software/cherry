import { type ReactNode, useState } from "react";
import type { AuthProvider } from "@cherry/mobile-shared";
import { Platform, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { LoadingDots, PressableScale, Text, useTheme } from "../../../shared/ui";
import { withAlpha } from "../../../shared/ui/utils/color";
import type { BusyProvider } from "./session-store";

/** Persona de demo del seed del backend: perfil completo con likes, matches y chats. */
export const DEMO_TEST_EMAIL = "demo@cherry.dev";

/** Segunda persona de demo (Hugo, sin interacciones): para probar matches en directo entre dos sesiones. */
export const DEMO2_TEST_EMAIL = "demo2@cherry.dev";

/** Email desechable para estrenar un usuario de pruebas (entra al onboarding desde cero). */
export function createFreshTestEmail(now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `nuevo-${now.toString(36)}-${suffix}@cherry.dev`;
}

/**
 * Colores de marca de terceros, no del tema (guías de Sign in with Apple y de Google Sign-In):
 * Apple, botón negro con logo y texto blancos; Google, la «G» de cuatro colores sobre blanco con
 * el contorno gris neutro de su botón claro.
 */
const providerBrand = {
  appleFill: "#000000",
  appleInk: "#FFFFFF",
  googleFill: "#FFFFFF",
  googleStroke: "#747775",
  googleInk: "#1F1F1F"
} as const;

const providerNames: Record<AuthProvider, string> = { google: "Google", apple: "Apple" };

/** Atenuado de «Próximamente»: el texto blanco sobre el negro atenuado sigue a ≥ 4.5:1. */
const SOON_OPACITY = 0.55;

/**
 * Sign in with Apple: `enabled` donde hay flujo nativo (iOS); `soon`, visible pero deshabilitado
 * («Próximamente»), en Android y en web, que de momento no lo tienen.
 */
export type AppleSignInAvailability = "enabled" | "soon";

export function defaultAppleAvailability(os: string = Platform.OS): AppleSignInAvailability {
  return os === "ios" ? "enabled" : "soon";
}

interface AuthActionListProps {
  busyProvider: BusyProvider | null;
  onSelect(provider: AuthProvider): void;
  /** Solo en desarrollo: login de pruebas (sin email = usuario de test compartido). */
  onTest?(email?: string): void;
  /** Por defecto según la plataforma (`defaultAppleAvailability`). */
  apple?: AppleSignInAvailability;
}

export function AuthActionList({ busyProvider, onSelect, onTest, apple }: AuthActionListProps) {
  const locked = busyProvider !== null;
  const appleAvailability = apple ?? defaultAppleAvailability();

  return (
    <View style={styles.list}>
      <ProviderButton
        busy={busyProvider === "google"}
        colors={{ fill: providerBrand.googleFill, text: providerBrand.googleInk, border: providerBrand.googleStroke }}
        disabled={locked}
        logo={<GoogleLogo size={20} />}
        onPress={() => onSelect("google")}
        provider="google"
        testID="login-google"
      />
      <ProviderButton
        busy={busyProvider === "apple"}
        colors={{ fill: providerBrand.appleFill, text: providerBrand.appleInk, border: null }}
        disabled={locked || appleAvailability === "soon"}
        logo={<AppleLogo color={providerBrand.appleInk} size={20} />}
        onPress={() => onSelect("apple")}
        provider="apple"
        soon={appleAvailability === "soon"}
        testID="login-apple"
      />
      {/* `__DEV__` y `EXPO_PUBLIC_*` son literales: el empaquetador los sustituye y elimina
          este bloque en producción salvo en builds internas con EXPO_PUBLIC_TEST_LOGIN=true
          (el backend solo acepta el acceso de prueba si corre en desarrollo, MIX_ENV=dev). */}
      {(__DEV__ || process.env.EXPO_PUBLIC_TEST_LOGIN === "true") && onTest ? (
        <DevSignIn busy={busyProvider === "test"} disabled={locked} onTest={onTest} />
      ) : null}
    </View>
  );
}

interface ProviderButtonProps {
  provider: AuthProvider;
  logo: ReactNode;
  /** `border: null` = sin contorno (Apple). */
  colors: { fill: string; text: string; border: string | null };
  busy: boolean;
  disabled: boolean;
  /** Visible pero sin flujo todavía: se atenúa y lo dice («Próximamente»). */
  soon?: boolean;
  onPress(): void;
  testID: string;
}

/**
 * Botón de proveedor: píldora de 56 pt con el logo a la izquierda y el texto centrado, sin
 * contornos de tinta ni sombras duras; al pulsar encoge un poco.
 */
function ProviderButton({ provider, logo, colors, busy, disabled, soon = false, onPress, testID }: ProviderButtonProps) {
  const theme = useTheme();
  const label = `Continuar con ${providerNames[provider]}`;
  const blocked = busy || disabled;

  return (
    <PressableScale
      accessibilityHint={soon ? `Próximamente: todavía no puedes entrar con ${providerNames[provider]} aquí.` : undefined}
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked, busy }}
      aria-busy={busy || undefined}
      disabled={blocked}
      elevation="none"
      faceStyle={[
        styles.providerFace,
        {
          backgroundColor: colors.fill,
          borderColor: colors.border ?? colors.fill,
          borderWidth: colors.border ? 1 : 0,
          borderRadius: theme.primitives.radius.pill
        },
        soon
          ? null
          : {
              boxShadow: `0 1px 2px ${withAlpha(theme.primitives.color.ink, 0.1)}, 0 4px 14px ${withAlpha(theme.primitives.color.ink, 0.08)}`
            }
      ]}
      haptic
      onPress={onPress}
      pressedScale={0.98}
      sinkWhenDisabled={false}
      style={disabled && !busy ? { opacity: soon ? SOON_OPACITY : theme.primitives.opacity.disabled } : null}
      testID={testID}
    >
      <View style={[styles.providerRow, { opacity: busy ? 0 : 1 }]}>
        <View style={styles.providerLogo}>{logo}</View>
        <View style={styles.providerText}>
          <RNText
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={[styles.providerLabel, { color: colors.text, fontFamily: theme.primitives.fonts.bold }]}
          >
            {label}
          </RNText>
          {soon ? (
            <RNText
              maxFontSizeMultiplier={1.3}
              style={[styles.soonText, { color: colors.text, fontFamily: theme.primitives.fonts.medium }]}
            >
              Próximamente
            </RNText>
          ) : null}
        </View>
        <View style={styles.providerTrail} />
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

type DevChoice = "new" | "demo" | "demo2";

const devShortcuts: { choice: DevChoice; label: string; short: string; testID: string }[] = [
  { choice: "new", label: "Entrar como usuario nuevo", short: "Nuevo", testID: "login-dev-new" },
  { choice: "demo", label: "Entrar como Lucía (demo)", short: "Lucía", testID: "login-dev-demo" },
  { choice: "demo2", label: "Entrar como Hugo (demo 2)", short: "Hugo", testID: "login-dev-demo2" }
];

/** Atajos de desarrollo, discretos: una fila de píldoras pequeñas. Nunca salen en producción. */
function DevSignIn({ busy, disabled, onTest }: DevSignInProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const [choice, setChoice] = useState<DevChoice | null>(null);

  function start(next: DevChoice) {
    setChoice(next);
    onTest(next === "new" ? createFreshTestEmail() : next === "demo" ? DEMO_TEST_EMAIL : DEMO2_TEST_EMAIL);
  }

  return (
    <View style={styles.devBox} testID="login-dev-tools">
      <Text color="muted" variant="caption">
        Pruebas
      </Text>
      <View style={styles.devRow}>
        {devShortcuts.map((shortcut) => {
          const loading = busy && choice === shortcut.choice;
          return (
            <Pressable
              accessibilityLabel={shortcut.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: disabled && !loading, busy: loading }}
              disabled={disabled}
              key={shortcut.choice}
              onPress={() => start(shortcut.choice)}
              style={({ pressed }) => [
                styles.devChip,
                { borderColor: c.dot, backgroundColor: pressed ? c.paperDeep : c.paper },
                disabled && !loading ? { opacity: theme.primitives.opacity.disabled } : null
              ]}
              testID={shortcut.testID}
            >
              {loading ? (
                <LoadingDots color={c.inkSoft} size={5} />
              ) : (
                <Text color="muted" variant="caption">
                  {shortcut.short}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
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

/** Manzana de Apple (solo en negro o blanco). */
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
    gap: 12
  },
  providerFace: {
    minHeight: 56,
    paddingHorizontal: 20,
    justifyContent: "center"
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  providerLogo: {
    width: 40,
    alignItems: "flex-start"
  },
  providerText: {
    flex: 1,
    alignItems: "center"
  },
  providerLabel: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: 0.1
  },
  providerTrail: {
    width: 40
  },
  providerLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  soonText: {
    fontSize: 12,
    lineHeight: 15
  },
  devBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 4
  },
  devRow: {
    flexDirection: "row",
    gap: 6
  },
  devChip: {
    minHeight: 30,
    minWidth: 58,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
