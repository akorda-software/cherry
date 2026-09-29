import { memo, useEffect, useId } from "react";
import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { mixHex, svgSafeId } from "./color-utils";

export interface PaperBackgroundProps {
  /** Tiñe el papel con el `soft` de un pastel (p. ej. un paso del onboarding). */
  tone?: PastelName;
  /** Trama de puntos de la libreta (por defecto, sí). */
  dotted?: boolean;
  /** Separación entre puntos en puntos de pantalla. */
  spacing?: number;
  /** Funde el color al cambiar de `tone` (se desactiva con «reducir movimiento»). */
  animateTone?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const DOT_RADIUS = 1.5;

/**
 * Papel de puntos de la libreta, a pantalla completa y sin capturar toques.
 * Un único SVG con `<Pattern>`: una sola baldosa, se ve igual en iOS, Android y web.
 * Colócalo como primer hijo del contenedor de la pantalla.
 */
export const PaperBackground = memo(function PaperBackground({
  tone,
  dotted = true,
  spacing = 20,
  animateTone = true,
  style,
  testID
}: PaperBackgroundProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const patternId = svgSafeId("paper-dots", useId());

  const swatch = tone ? theme.primitives.pastel[tone] : null;
  const paper = swatch ? swatch.soft : theme.semantic.color.screenBackground;
  // Sobre papel teñido, los puntos son el mismo pastel un poco más subido.
  const dot = swatch ? mixHex(swatch.soft, swatch.fill, 0.55) : theme.semantic.color.paperDot;

  const background = useSharedValue(paper);

  useEffect(() => {
    background.value =
      animateTone && !reducedMotion ? withTiming(paper, { duration: theme.primitives.motion.slow }) : paper;
  }, [animateTone, background, paper, reducedMotion, theme.primitives.motion.slow]);

  const paperStyle = useAnimatedStyle(() => ({ backgroundColor: background.value }));

  return (
    <Animated.View testID={testID} aria-hidden style={[styles.fill, paperStyle, style]}>
      {dotted ? (
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={patternId} patternUnits="userSpaceOnUse" x={0} y={0} width={spacing} height={spacing}>
              <Circle cx={spacing / 2} cy={spacing / 2} r={DOT_RADIUS} fill={dot} />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${patternId})`} />
        </Svg>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: "none"
  }
});
