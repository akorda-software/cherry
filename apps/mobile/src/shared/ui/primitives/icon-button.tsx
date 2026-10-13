import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import type { HapticKind } from "../motion/haptics";
import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";
import type { PastelName } from "../tokens/primitives/color";
import type { ElevationLevel } from "../tokens/primitives/elevation";
import { Badge } from "./badge";
import { IconSlot, type IconSource } from "./icon-slot";
import { PressableScale } from "./pressable-scale";

export type IconButtonSize = "sm" | "md" | "lg" | "xl";
export type IconButtonColor = PastelName | "white" | "ink";

export interface IconButtonProps {
  icon: IconSource;
  /** Obligatorio: el botón no tiene texto visible. */
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** sm 40 · md 48 · lg 64 · xl 76. */
  size?: IconButtonSize;
  color?: IconButtonColor;
  /** Relleno pastel del icono (p. ej. corazón relleno). */
  iconFill?: string;
  /** Contador (número) o punto (`true`) en la esquina. */
  badge?: number | boolean;
  /** Estado de interruptor (aria-pressed); sin `color` se rellena de limonada. */
  selected?: boolean;
  disabled?: boolean;
  /** Háptico al pulsar (`true` = ligero). */
  haptic?: HapticKind | boolean;
  /** Sin sombra (p. ej. dentro de una barra). */
  flat?: boolean;
  onPress?(): void;
  onLongPress?(): void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

interface Spec {
  size: number;
  icon: number;
  border: number;
  elevation: ElevationLevel;
}

function spec(theme: AppTheme, size: IconButtonSize): Spec {
  const { border } = theme.primitives;

  switch (size) {
    case "sm":
      return { size: 40, icon: 20, border: border.regular, elevation: "sm" };
    case "lg":
      return { size: theme.primitives.size.actionButton, icon: 30, border: border.bold, elevation: "md" };
    case "xl":
      return { size: theme.primitives.size.actionButtonLarge, icon: 36, border: border.bold, elevation: "lg" };
    default:
      return { size: 48, icon: 24, border: border.regular, elevation: "md" };
  }
}

/**
 * Botón redondo y gordo (✕ / ↺ / ♥ de Descubrir, cerrar, atrás…). Se hunde
 * hacia su sombra, se aplasta un poco y vuelve con rebote.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  accessibilityHint,
  size = "md",
  color,
  iconFill,
  badge,
  selected,
  disabled = false,
  haptic,
  flat = false,
  onPress,
  onLongPress,
  testID,
  style
}: IconButtonProps) {
  const theme = useTheme();
  const s = spec(theme, size);
  const c = theme.primitives.color;
  const resolvedColor: IconButtonColor = color ?? (selected ? "limonada" : "white");

  const fill = disabled
    ? theme.semantic.action.disabledBackground
    : resolvedColor === "white"
      ? c.white
      : resolvedColor === "ink"
        ? c.ink
        : theme.primitives.pastel[resolvedColor].fill;
  const ink = disabled ? c.inkFaint : resolvedColor === "ink" ? c.white : c.ink;

  return (
    <View style={[styles.wrap, { width: s.size, height: s.size }, style]}>
      <PressableScale
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        aria-pressed={selected}
        disabled={disabled}
        elevation={flat ? "none" : s.elevation}
        faceStyle={{
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          borderWidth: s.border,
          borderColor: disabled ? c.inkFaint : c.ink,
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center"
        }}
        haptic={haptic}
        hitSlop={s.size < 48 ? (48 - s.size) / 2 : undefined}
        onLongPress={onLongPress}
        onPress={onPress}
        pressedScale={0.94}
        releaseSpring="pop"
        testID={testID}
      >
        <IconSlot color={ink} fill={iconFill} icon={icon} size={s.icon} />
      </PressableScale>
      {badge ? (
        <Badge
          count={typeof badge === "number" ? badge : undefined}
          dot={badge === true}
          size={s.size <= 48 ? "sm" : "md"}
          style={styles.badge}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative"
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4
  }
});
