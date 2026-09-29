import type { PropsWithChildren } from "react";
import { type StyleProp, StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";

import type { HapticKind } from "../motion/haptics";
import { useTheme } from "../providers/theme-provider";
import type { AppTheme } from "../themes/theme-types";
import type { primitiveBorderTokens } from "../tokens/primitives/border";
import type { PastelName } from "../tokens/primitives/color";
import { type ElevationLevel, elevationOffsets } from "../tokens/primitives/elevation";
import type { primitiveRadiusTokens } from "../tokens/primitives/radius";
import { PressableScale } from "./pressable-scale";
import { resolveSpacing, type SpacingKey } from "./stack";

export type SurfaceColor = PastelName | "white" | "paper" | "paperDeep" | "ink";
export type RadiusKey = keyof typeof primitiveRadiusTokens;
export type BorderKey = keyof typeof primitiveBorderTokens;

export interface SurfaceProps extends ViewProps {
  /** Relleno: blanco (por defecto), papel o un pastel. */
  color?: SurfaceColor;
  /** Usa el tono `Soft` del pastel (fondos tranquilos). */
  soft?: boolean;
  /** @deprecated usa `color`. base → blanco, elevated → papel hondo, selected → limonada. */
  tone?: "base" | "elevated" | "selected";
  /** Sombra dura (por defecto `md`). */
  elevation?: ElevationLevel;
  radius?: RadiusKey | number;
  padding?: SpacingKey | number;
  /** Grosor del contorno (por defecto `bold`, 3 px: superficies grandes). */
  border?: BorderKey;
  bordered?: boolean;
  /** Giro en grados (scrapbook). */
  rotate?: number;
  /** Recorta el contenido a las esquinas (fotos, filas resaltadas) sin recortar la sombra. */
  clip?: boolean;
  /** Si se pasa, la superficie entera es pulsable y se hunde hacia su sombra. */
  onPress?(): void;
  onLongPress?(): void;
  disabled?: boolean;
  haptic?: HapticKind | boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function resolveSurfaceColor(theme: AppTheme, color: SurfaceColor, soft = false): string {
  const c = theme.primitives.color;

  switch (color) {
    case "white":
      return c.white;
    case "paper":
      return c.paper;
    case "paperDeep":
      return c.paperDeep;
    case "ink":
      return c.ink;
    default:
      return soft ? theme.primitives.pastel[color].soft : theme.primitives.pastel[color].fill;
  }
}

function legacyToneColor(tone: SurfaceProps["tone"]): SurfaceColor | undefined {
  if (tone === "elevated") return "paperDeep";
  if (tone === "selected") return "limonada";
  if (tone === "base") return "white";
  return undefined;
}

/**
 * Hoja de papel con contorno de tinta y sombra dura. Si recibe `onPress` se
 * comporta como pulsable neobrutal. Nunca anides superficies dentro de otras.
 */
export function Surface({
  children,
  color,
  soft,
  tone,
  elevation = "md",
  radius = "md",
  padding = "md",
  border = "bold",
  bordered = true,
  rotate,
  clip = false,
  onPress,
  onLongPress,
  disabled,
  haptic,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
  ...props
}: PropsWithChildren<SurfaceProps>) {
  const theme = useTheme();
  const fill = resolveSurfaceColor(theme, color ?? legacyToneColor(tone) ?? "white", soft);
  const borderRadius = typeof radius === "number" ? radius : theme.primitives.radius[radius];

  const face: ViewStyle = {
    backgroundColor: fill,
    borderRadius,
    borderWidth: bordered ? theme.primitives.border[border] : 0,
    borderColor: theme.primitives.color.ink,
    padding: resolveSpacing(theme.primitives.spacing, padding)
  };

  if (onPress || onLongPress) {
    return (
      <PressableScale
        faceStyle={clip ? [face, styles.clip] : face}
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        elevation={elevation}
        haptic={haptic}
        onLongPress={onLongPress}
        onPress={onPress}
        rotate={rotate}
        style={style}
        testID={testID}
      >
        {children}
      </PressableScale>
    );
  }

  if (clip) {
    const offset = elevationOffsets[elevation];

    return (
      <View
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}
        testID={testID}
        {...props}
      >
        {offset > 0 ? (
          <View
            style={[
              styles.shadow,
              { top: offset, left: offset, right: -offset, bottom: -offset, borderRadius, backgroundColor: theme.primitives.color.ink }
            ]}
          />
        ) : null}
        <View style={[face, styles.clip, styles.grow]}>{children}</View>
      </View>
    );
  }

  return (
    <View
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      style={[
        face,
        theme.primitives.elevation[elevation],
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style
      ]}
      testID={testID}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: "absolute",
    pointerEvents: "none"
  },
  clip: {
    overflow: "hidden"
  },
  grow: {
    flexGrow: 1
  }
});
