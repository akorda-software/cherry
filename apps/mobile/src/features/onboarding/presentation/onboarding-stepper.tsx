import { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { useRouter } from "expo-router";

import { useTheme } from "../../../shared/ui";

interface StepConfig {
  key: string;
  label: string;
  route: string;
}

export const ONBOARDING_STEPS: ReadonlyArray<StepConfig> = [
  { key: "profile", label: "Perfil", route: "/(onboarding)/profile" },
  { key: "bio", label: "Bio", route: "/(onboarding)/bio" },
  { key: "preferences", label: "Prefs", route: "/(onboarding)/preferences" },
  { key: "tags", label: "Tags", route: "/(onboarding)/tags" }
];

interface OnboardingStepperProps {
  activePath: string;
}

export function OnboardingStepper({ activePath }: OnboardingStepperProps) {
  const theme = useTheme();
  const router = useRouter();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: theme.primitives.spacing.md,
          paddingVertical: theme.primitives.spacing.sm,
          backgroundColor: theme.semantic.color.surfaceBackground,
          borderBottomWidth: theme.primitives.border.bold,
          borderBottomColor: theme.primitives.color.ink
        },
        tab: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: theme.primitives.spacing.xs,
          paddingVertical: theme.primitives.spacing.sm,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          borderRadius: theme.primitives.radius.sm,
          backgroundColor: theme.semantic.color.screenBackground,
          marginHorizontal: 2
        },
        tabActive: {
          backgroundColor: theme.primitives.color.blue,
          ...theme.primitives.elevation.sm
        },
        number: {
          fontSize: 13,
          fontWeight: "900" as any,
          color: theme.semantic.text.default
        },
        numberActive: {
          color: theme.semantic.color.surfaceBackground
        },
        label: {
          fontSize: 12,
          fontWeight: "800" as any,
          color: theme.semantic.text.default,
          letterSpacing: 0.3,
          textTransform: "uppercase" as any
        },
        labelActive: {
          color: theme.semantic.color.surfaceBackground
        }
      }),
    [theme]
  );

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {ONBOARDING_STEPS.map((step, index) => {
        const isActive = activePath === step.route;
        return (
          <Pressable
            key={step.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Paso ${index + 1}: ${step.label}`}
            onPress={() => router.replace(step.route)}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : null,
              pressed ? { transform: [{ translateY: 2 }] } : null
            ]}
          >
            <RNText style={[styles.number, isActive ? styles.numberActive : null]}>
              {index + 1}
            </RNText>
            <RNText style={[styles.label, isActive ? styles.labelActive : null]} numberOfLines={1}>
              {step.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}
