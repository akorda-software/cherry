import { type ReactNode, useMemo } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import type { HapticKind } from "../motion/haptics";
import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";
import type { PastelName } from "../tokens/primitives/color";
import type { ElevationLevel } from "../tokens/primitives/elevation";
import type { TextVariant } from "../tokens/primitives/typography";
import { IconSlot, type IconSource } from "./icon-slot";
import { LoadingDots } from "./loading-dots";
import { PressableScale } from "./pressable-scale";
import { Text } from "./text";

export type ButtonVariant = "primary" | "secondary" | "soft" | "danger" | "ghost" | "ink";
export type ButtonSize = "lg" | "md" | "sm";

export interface ButtonProps {
  /** Texto del botón (o nodos). */
  children?: ReactNode;
  /** Alternativa a `children` para el texto. */
  label?: string;
  /** primary = fresa · secondary = blanco · soft = lavanda suave · danger = tomate · ghost = solo texto · ink = tinta. */
  variant?: ButtonVariant;
  /** @deprecated usa `variant`. `destructive` equivale a `danger`. */
  tone?: "primary" | "destructive";
  /** Pastel que sustituye el relleno de `primary`/`soft` (o la sombra de `ink`). */
  color?: PastelName;
  size?: ButtonSize;
  icon?: IconSource;
  iconRight?: IconSource;
  /** Muestra puntitos que rebotan y bloquea el toque (sin cambiar el tamaño). */
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Háptico al pulsar (`true` = ligero). */
  haptic?: HapticKind | boolean;
  rotate?: number;
  onPress?(): void;
  onLongPress?(): void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface SizeSpec {
  height: number;
  paddingX: number;
  text: TextVariant;
  icon: number;
  gap: number;
  border: number;
  elevation: ElevationLevel;
  dot: number;
}

function sizeSpec(theme: AppTheme, size: ButtonSize): SizeSpec {
  const { border } = theme.primitives;

  switch (size) {
    case "lg":
      return { height: 60, paddingX: 28, text: "button", icon: 22, gap: 10, border: border.bold, elevation: "md", dot: 8 };
    case "sm":
      return { height: 40, paddingX: 16, text: "buttonSmall", icon: 18, gap: 6, border: border.regular, elevation: "sm", dot: 6 };
    default:
      return { height: 52, paddingX: 22, text: "button", icon: 20, gap: 8, border: border.regular, elevation: "md", dot: 7 };
  }
}

interface VariantColors {
  fill: string;
  text: string;
  border: string;
  shadow: string;
  elevated: boolean;
}

function variantColors(theme: AppTheme, variant: ButtonVariant, color: PastelName | undefined, disabled: boolean): VariantColors {
  const c = theme.primitives.color;

  if (disabled) {
    return {
      fill: variant === "ghost" ? "transparent" : theme.semantic.action.disabledBackground,
      text: theme.semantic.action.disabledForeground,
      border: variant === "ghost" ? "transparent" : c.inkFaint,
      shadow: c.ink,
      elevated: false
    };
  }

  switch (variant) {
    case "secondary":
      return { fill: c.white, text: c.ink, border: c.ink, shadow: c.ink, elevated: true };
    case "soft":
      return { fill: theme.primitives.pastel[color ?? "lavanda"].soft, text: c.ink, border: c.ink, shadow: c.ink, elevated: true };
    case "danger":
      return { fill: theme.semantic.action.destructiveBackground, text: c.ink, border: c.ink, shadow: c.ink, elevated: true };
    case "ghost":
      return { fill: "transparent", text: c.ink, border: "transparent", shadow: c.ink, elevated: false };
    case "ink":
      return { fill: c.ink, text: c.white, border: c.ink, shadow: theme.primitives.pastel[color ?? "fresa"].fill, elevated: true };
    default:
      return {
        fill: color ? theme.primitives.pastel[color].fill : theme.semantic.action.primaryBackground,
        text: c.ink,
        border: c.ink,
        shadow: c.ink,
        elevated: true
      };
  }
}

/**
 * Botón pastilla neobrutal: contorno de tinta, sombra dura y se hunde al
 * pulsar. Deshabilitado queda pegado al papel; al habilitarse «sube».
 */
export function Button({
  children,
  label,
  variant,
  tone,
  color,
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic,
  rotate,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style
}: ButtonProps) {
  const theme = useTheme();
  const resolvedVariant: ButtonVariant = variant ?? (tone === "destructive" ? "danger" : "primary");
  const spec = sizeSpec(theme, size);
  const colors = variantColors(theme, resolvedVariant, color, disabled);
  const content = children ?? label;
  const textLabel = typeof content === "string" ? content : undefined;

  const face = useMemo<ViewStyle>(
    () => ({
      minHeight: spec.height,
      paddingHorizontal: resolvedVariant === "ghost" ? spec.paddingX * 0.6 : spec.paddingX,
      borderRadius: theme.primitives.radius.pill,
      borderWidth: resolvedVariant === "ghost" ? 0 : spec.border,
      borderColor: colors.border,
      backgroundColor: colors.fill,
      alignItems: "center",
      justifyContent: "center"
    }),
    [colors.border, colors.fill, resolvedVariant, spec, theme]
  );

  return (
    <PressableScale
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? textLabel}
      accessibilityState={{ disabled, busy: loading }}
      aria-busy={loading || undefined}
      data-variant={resolvedVariant}
      disabled={disabled}
      elevation={colors.elevated ? spec.elevation : "none"}
      faceStyle={face}
      haptic={haptic}
      hitSlop={size === "sm" ? { top: 4, bottom: 4, left: 2, right: 2 } : undefined}
      onLongPress={loading ? undefined : onLongPress}
      onPress={loading ? undefined : onPress}
      rotate={rotate}
      shadowColor={colors.shadow}
      style={[fullWidth ? styles.fullWidth : null, style]}
      testID={testID}
    >
      <View style={[styles.row, { gap: spec.gap, opacity: loading ? 0 : 1 }]}>
        <IconSlot color={colors.text} icon={icon} size={spec.icon} />
        {typeof content === "string" || typeof content === "number" ? (
          <Text
            adjustsFontSizeToFit
            color={colors.text}
            minimumFontScale={0.85}
            numberOfLines={1}
            style={resolvedVariant === "ghost" ? styles.ghostLabel : null}
            variant={spec.text}
          >
            {content}
          </Text>
        ) : (
          content
        )}
        <IconSlot color={colors.text} icon={iconRight} size={spec.icon} />
      </View>
      {loading ? (
        <View style={styles.loading}>
          <LoadingDots accessibilityLabel="Cargando" color={colors.text} size={spec.dot} />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    alignSelf: "stretch"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center"
  },
  ghostLabel: {
    textDecorationLine: "underline"
  }
});
