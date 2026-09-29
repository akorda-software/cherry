import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { HEART } from "./icon-paths";
import { WORDMARK_PATH } from "./wordmark-path";

export interface LogoProps {
  /** Alto total en puntos, pegatina y corazón incluidos (def. 40). */
  height?: number;
  /** `sticker`: troquelado blanco, contorno y sombra dura. `plain`: solo letras. */
  variant?: "sticker" | "plain";
  /** Letras rellenas de un pastel con contorno de tinta (para portadas). Por defecto, tinta. */
  fill?: PastelName;
  /** Corazoncito pegado arriba a la derecha (def. sí). */
  heart?: boolean;
  /** Def. «Snack». */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Unidades de la caja de la palabra (364 × 100).
const RIM = 13;
const OUTLINE = 6;
const SHADOW = 9;
const LETTER_STROKE = 9;
const HEART_SCALE = 2.1;
const HEART_TRANSFORM = `translate(372 -30) scale(${HEART_SCALE}) rotate(14 12 12)`;
const VIEWBOX = {
  sticker: { x: -22, y: -48, w: 472, h: 179 },
  plain: { x: -6, y: -34, w: 434, h: 140 }
} as const;

/** Logo «snack»: la palabra en Mochiy como pegatina troquelada, con un corazón. */
export const Logo = memo(function Logo({
  height = 40,
  variant = "sticker",
  fill,
  heart = true,
  accessibilityLabel = "Snack",
  style,
  testID
}: LogoProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const box = VIEWBOX[variant];
  const width = (height * box.w) / box.h;
  const letterFill = fill ? theme.primitives.pastel[fill].fill : c.ink;
  const letterStroke = fill ? LETTER_STROKE : 0;
  const outer = letterStroke + 2 * (RIM + OUTLINE);
  const rim = letterStroke + 2 * RIM;
  const heartFill = fill === "fresa" ? c.limonada : c.fresa;

  const layers = (d: string, scale: number, inner: { fill: string; stroke?: string; width?: number }) =>
    variant === "sticker" ? (
      <>
        <Path d={d} transform={`translate(${SHADOW / scale} ${SHADOW / scale})`} fill={c.ink} stroke={c.ink} strokeWidth={outer / scale} strokeLinejoin="round" />
        <Path d={d} fill={c.ink} stroke={c.ink} strokeWidth={outer / scale} strokeLinejoin="round" />
        <Path d={d} fill={c.white} stroke={c.white} strokeWidth={rim / scale} strokeLinejoin="round" />
        <Path d={d} fill={inner.fill} stroke={inner.stroke} strokeWidth={inner.width} strokeLinejoin="round" />
      </>
    ) : (
      <Path d={d} fill={inner.fill} stroke={inner.stroke} strokeWidth={inner.width} strokeLinejoin="round" />
    );

  return (
    <View
      testID={testID}
      style={[{ width, height }, style]}
      accessible
      role="img"
      aria-label={accessibilityLabel}
    >
      <Svg width={width} height={height} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
        {layers(WORDMARK_PATH, 1, {
          fill: letterFill,
          stroke: letterStroke ? c.ink : undefined,
          width: letterStroke || undefined
        })}
        {heart ? (
          <G transform={HEART_TRANSFORM}>
            {layers(HEART, HEART_SCALE, { fill: heartFill, stroke: c.ink, width: 7 / HEART_SCALE })}
          </G>
        ) : null}
      </Svg>
    </View>
  );
});
