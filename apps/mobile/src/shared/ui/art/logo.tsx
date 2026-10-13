import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { HEART } from "./icon-paths";
import {
  CHERRY_BALLS_PATH,
  CHERRY_LEAF_PATH,
  CHERRY_SHINE_PATH,
  CHERRY_STEMS_GAP_PATH,
  CHERRY_STEMS_PATH,
  WORDMARK_PATH
} from "./wordmark-path";

export interface LogoProps {
  /** Alto total en puntos, pegatina incluida (def. 40). */
  height?: number;
  /** `sticker`: troquelado blanco, contorno y sombra dura. `plain`: solo letras y cerezas. */
  variant?: "sticker" | "plain";
  /** Letras rellenas de un pastel con contorno de tinta (para portadas). Por defecto, tinta. */
  fill?: PastelName;
  /** Corazoncito pegado arriba a la derecha (def. no: ya están las cerezas). */
  heart?: boolean;
  /** Def. «Cherry». */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Unidades de la caja de la palabra (≈ 1200 × 400, más rabitos arriba y la «y» abajo).
const RIM = 39;
const OUTLINE = 18;
const SHADOW = 27;
const LETTER_STROKE = 22;
const STEM = 15;
const LEAF_STROKE = 12;
const CHERRY_STROKE = 14;
const SHINE = 10;
const HEART_SCALE = 6.3;
const HEART_TRANSFORM = `translate(1080 -330) scale(${HEART_SCALE}) rotate(14 12 12)`;
const VIEWBOX = {
  sticker: { x: -65, y: -497, w: 1365, h: 693 },
  plain: { x: -8, y: -440, w: 1224, h: 552 }
} as const;

/**
 * Logo «cherry»: la palabra en Fraunces Black, sola o como pegatina troquelada; las bolas de
 * las dos erres son un par de cerezas unidas por los rabitos y una hoja.
 */
export const Logo = memo(function Logo({
  height = 40,
  variant = "sticker",
  fill,
  heart = false,
  accessibilityLabel = "Cherry",
  style,
  testID
}: LogoProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const pastel = theme.primitives.pastel;
  const box = VIEWBOX[variant];
  const width = (height * box.w) / box.h;
  const letterFill = fill ? pastel[fill].fill : c.ink;
  const letterStroke = fill ? LETTER_STROKE : 0;
  // Con letras fresa, las cerezas pasan a tomate para no confundirse con ellas.
  const cherryFill = fill === "fresa" ? pastel.tomate.fill : pastel.fresa.fill;
  const heartFill = fill === "fresa" ? pastel.limonada.fill : pastel.fresa.fill;
  const outer = 2 * (RIM + OUTLINE);
  const rim = 2 * RIM;

  // Silueta completa (letras, cerezas, hoja, rabitos y el hueco entre ellos) con un grosor de trazo dado: sombra,
  // contorno y troquel blanco de la pegatina.
  const silhouette = (color: string, extra: number) => (
    <>
      <Path d={WORDMARK_PATH} fill={color} stroke={color} strokeWidth={letterStroke + extra} strokeLinejoin="round" />
      <Path d={CHERRY_BALLS_PATH} fill={color} stroke={color} strokeWidth={CHERRY_STROKE + extra} strokeLinejoin="round" />
      <Path d={CHERRY_LEAF_PATH} fill={color} stroke={color} strokeWidth={LEAF_STROKE + extra} strokeLinejoin="round" />
      <Path d={CHERRY_STEMS_GAP_PATH} fill={color} stroke={color} strokeWidth={STEM + extra} strokeLinejoin="round" />
      <Path d={CHERRY_STEMS_PATH} fill="none" stroke={color} strokeWidth={STEM + extra} strokeLinecap="round" />
    </>
  );

  const heartLayers = (inner: { fill: string; stroke: string; width: number }) =>
    variant === "sticker" ? (
      <>
        <Path d={HEART} transform={`translate(${SHADOW / HEART_SCALE} ${SHADOW / HEART_SCALE})`} fill={c.ink} stroke={c.ink} strokeWidth={(inner.width * HEART_SCALE + outer) / HEART_SCALE} strokeLinejoin="round" />
        <Path d={HEART} fill={c.ink} stroke={c.ink} strokeWidth={(inner.width * HEART_SCALE + outer) / HEART_SCALE} strokeLinejoin="round" />
        <Path d={HEART} fill={c.white} stroke={c.white} strokeWidth={(inner.width * HEART_SCALE + rim) / HEART_SCALE} strokeLinejoin="round" />
        <Path d={HEART} fill={inner.fill} stroke={inner.stroke} strokeWidth={inner.width} strokeLinejoin="round" />
      </>
    ) : (
      <Path d={HEART} fill={inner.fill} stroke={inner.stroke} strokeWidth={inner.width} strokeLinejoin="round" />
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
        {variant === "sticker" ? (
          <>
            <G transform={`translate(${SHADOW} ${SHADOW})`}>{silhouette(c.ink, outer)}</G>
            {silhouette(c.ink, outer)}
            {silhouette(c.white, rim)}
          </>
        ) : null}
        <Path
          d={WORDMARK_PATH}
          fill={letterFill}
          stroke={letterStroke ? c.ink : undefined}
          strokeWidth={letterStroke || undefined}
          strokeLinejoin="round"
        />
        <Path d={CHERRY_STEMS_PATH} fill="none" stroke={c.ink} strokeWidth={STEM} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={CHERRY_LEAF_PATH} fill={pastel.menta.fill} stroke={c.ink} strokeWidth={LEAF_STROKE} strokeLinejoin="round" />
        <Path d={CHERRY_BALLS_PATH} fill={cherryFill} stroke={c.ink} strokeWidth={CHERRY_STROKE} />
        <Path d={CHERRY_SHINE_PATH} fill="none" stroke={c.paper} strokeWidth={SHINE} strokeLinecap="round" />
        {heart ? (
          <G transform={HEART_TRANSFORM}>
            {heartLayers({ fill: heartFill, stroke: c.ink, width: 7 / HEART_SCALE })}
          </G>
        ) : null}
      </Svg>
    </View>
  );
});
