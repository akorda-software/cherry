import type { AuthProvider } from "@snack/mobile-shared";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Stack, useTheme } from "../../../shared/ui";

interface AuthActionListProps {
  busyProvider: AuthProvider | null;
  onSelect(provider: AuthProvider): void;
}

export function AuthActionList({ busyProvider, onSelect }: AuthActionListProps) {
  const disabled = busyProvider !== null;

  return (
    <Stack>
      <GoogleButton disabled={disabled} onPress={() => onSelect("google")} />
      <AppleButton disabled={disabled} onPress={() => onSelect("apple")} />
    </Stack>
  );
}

interface BrandButtonProps {
  disabled: boolean;
  onPress(): void;
}

function GoogleButton({ disabled, onPress }: BrandButtonProps) {
  const theme = useTheme();
  const styles = StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: "#FFFFFF",
      borderColor: "#DADCE0",
      borderWidth: 1,
      borderRadius: theme.primitives.radius.pill,
      minHeight: 52,
      paddingHorizontal: theme.primitives.spacing.md,
      paddingVertical: theme.primitives.spacing.sm,
      opacity: disabled ? 0.5 : 1,
    },
    label: {
      color: "#1F1F1F",
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
  });

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress()}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? { opacity: 0.85 } : null,
      ]}
    >
      <GoogleLogo size={22} />
      <RNText style={styles.label}>Continue with Google</RNText>
    </Pressable>
  );
}

function AppleButton({ disabled, onPress }: BrandButtonProps) {
  const theme = useTheme();
  const styles = StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: "#000000",
      borderRadius: theme.primitives.radius.pill,
      minHeight: 52,
      paddingHorizontal: theme.primitives.spacing.md,
      paddingVertical: theme.primitives.spacing.sm,
      opacity: disabled ? 0.5 : 1,
    },
    label: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
  });

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onPress()}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? { opacity: 0.8 } : null,
      ]}
    >
      <AppleLogo size={20} color="#FFFFFF" />
      <RNText style={styles.label}>Continue with Apple</RNText>
    </Pressable>
  );
}

function GoogleLogo({ size }: { size: number }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <Path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <Path
          fill="#FBBC04"
          d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <Path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7C13.42 14.62 18.27 10.75 24 10.75z"
        />
      </Svg>
    </View>
  );
}

function AppleLogo({ size, color }: { size: number; color: string }) {
  return (
    <View aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill={color}
          d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
      </Svg>
    </View>
  );
}
