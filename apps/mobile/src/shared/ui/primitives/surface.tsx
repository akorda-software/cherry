import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../providers/theme-provider";

type SurfaceTone = "base" | "elevated" | "selected";

export function Surface({ children, style, tone = "base", ...props }: PropsWithChildren<{ tone?: SurfaceTone; style?: any; accessibilityLabel?: string }>) {
  const theme = useTheme();

  const backgroundColor =
    tone === "elevated"
      ? theme.semantic.surface.elevated
      : tone === "selected"
        ? theme.semantic.surface.selected
        : theme.semantic.surface.base;

  const styles = StyleSheet.create({
    surface: {
      backgroundColor,
      borderWidth: theme.primitives.border.thin,
      borderColor: theme.semantic.border.subtle,
      borderRadius: theme.primitives.radius.md,
      padding: theme.primitives.spacing.md,
    },
  });

  return (
    <View style={[styles.surface, style]} {...props}>
      {children}
    </View>
  );
}
