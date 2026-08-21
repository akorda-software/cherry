import type { PropsWithChildren } from "react";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../providers/theme-provider";

interface ButtonProps extends PropsWithChildren {
  tone?: "primary" | "destructive";
  disabled?: boolean;
  onPress?(): void;
  testID?: string;
}

const SHADOW_OFFSET = 4;

export function Button({
  children,
  disabled,
  onPress,
  style,
  tone = "primary",
  ...props
}: ButtonProps & { style?: any }) {
  const theme = useTheme();

  const backgroundColor = disabled
    ? theme.semantic.action.disabledBackground
    : tone === "destructive"
      ? theme.semantic.action.destructiveBackground
      : theme.semantic.action.primaryBackground;

  const color = disabled
    ? theme.semantic.action.disabledForeground
    : tone === "destructive"
      ? theme.semantic.action.destructiveForeground
      : theme.semantic.action.primaryForeground;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          backgroundColor,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          borderRadius: theme.primitives.radius.sm,
          minHeight: theme.semantic.layout.touchTargetMinHeight,
          paddingHorizontal: theme.primitives.spacing.md,
          paddingVertical: theme.primitives.spacing.sm,
          alignItems: "center",
          justifyContent: "center"
        },
        label: {
          color,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: "700" as any,
          textTransform: "uppercase" as any,
          letterSpacing: 0.4
        }
      }),
    [backgroundColor, color, theme]
  );

  return (
    <Pressable
      data-tone={tone}
      disabled={disabled}
      onPress={() => onPress?.()}
      style={({ pressed }) => [
        styles.button,
        theme.primitives.elevation.md,
        pressed && !disabled
          ? {
              transform: [{ translateX: SHADOW_OFFSET }, { translateY: SHADOW_OFFSET }],
              ...theme.primitives.elevation.none
            }
          : null,
        style
      ]}
      {...props}
    >
      <RNText style={styles.label}>{children}</RNText>
    </Pressable>
  );
}
