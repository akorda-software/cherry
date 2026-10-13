import { memo, useEffect, useId } from "react";
import { Image, Platform, type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { mixHex, svgSafeId } from "./color-utils";

export interface PaperBackgroundProps {
  /** Tiñe el papel con el `soft` de un pastel (p. ej. un paso del onboarding). */
  tone?: PastelName;
  /** Trama de puntos de la libreta (por defecto, sí). */
  dotted?: boolean;
  /** Funde el color al cambiar de `tone` (se desactiva con «reducir movimiento»). */
  animateTone?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Baldosa de 20 pt con un punto blanco centrado (1x/2x/3x); se tiñe con `tintColor`. */
const DOT_TILE = require("../../../../assets/images/paper-dot.png");

/**
 * Papel de puntos de la libreta, a pantalla completa y sin capturar toques.
 * La trama es una baldosa PNG repetida por el sistema (`resizeMode="repeat"`) y
 * teñida con `tintColor`: la pinta la GPU, sin rasterizar SVG en cada pantalla.
 * Colócalo como primer hijo del contenedor de la pantalla.
 */
export const PaperBackground = memo(function PaperBackground({
  tone,
  dotted = true,
  animateTone = true,
  style,
  testID
}: PaperBackgroundProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();

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
      {dotted && Platform.OS === "web" ? (
        <WebDots color={dot} testID={testID ? `${testID}-dots` : undefined} />
      ) : dotted ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="repeat"
          source={DOT_TILE}
          style={[styles.fill, { tintColor: dot }]}
          testID={testID ? `${testID}-dots` : undefined}
        />
      ) : null}
    </Animated.View>
  );
});

/**
 * En web (solo banco de pruebas) `resizeMode="repeat"` no tesela una imagen teñida:
 * la trama se dibuja con un `<Pattern>` SVG.
 */
function WebDots({ color, testID }: { color: string; testID?: string }) {
  const id = svgSafeId("paper-dots", useId());
  return (
    <Svg height="100%" testID={testID} width="100%">
      <Defs>
        <Pattern height={20} id={id} patternUnits="userSpaceOnUse" width={20} x={0} y={0}>
          <Circle cx={10} cy={10} fill={color} r={1.5} />
        </Pattern>
      </Defs>
      <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
    </Svg>
  );
}

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
