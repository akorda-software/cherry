import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import {
  CHERRY_MARK_BIG_HEART_PATH,
  CHERRY_MARK_CHERRIES,
  CHERRY_MARK_HEIGHT,
  CHERRY_MARK_SMALL_HEART_PATH,
  CHERRY_MARK_STALK_PATH,
  CHERRY_MARK_STEM_WIDTH,
  CHERRY_MARK_STEMS_PATH,
  CHERRY_MARK_VIEWBOX,
  CHERRY_MARK_WIDTH
} from "./cherry-mark-geometry";

/** `color`: el logo a color. `ink` / `white`: de una sola tinta (sobre foto o en monocromo). */
export type CherryMarkTone = "color" | "ink" | "white";

/** Partes que se pueden pintar por separado (la animación de arranque mueve cada una). */
export type CherryMarkPart = "stalk" | "cherries" | "bigHeart" | "smallHeart";

export interface CherryMarkColors {
  stem: string;
  leaf: string;
  cherry: string;
  shine: string;
}

export function useCherryMarkColors(tone: CherryMarkTone = "color"): CherryMarkColors {
  const theme = useTheme();
  const c = theme.primitives.color;
  const pastel = theme.primitives.pastel;

  if (tone === "color") {
    return { stem: c.ink, leaf: pastel.menta.deep, cherry: pastel.fresa.fill, shine: c.paper };
  }

  const solid = tone === "ink" ? c.ink : c.white;
  // De una tinta, los brillos no se ven: el contorno de las cerezas ya dice qué es.
  return { stem: solid, leaf: solid, cherry: solid, shine: solid };
}

/** Ancho del logo para un alto dado (el dibujo es más alto que ancho). */
export function cherryMarkWidth(height: number): number {
  return (height * CHERRY_MARK_WIDTH) / CHERRY_MARK_HEIGHT;
}

interface CherryMarkShapesProps {
  colors: CherryMarkColors;
  parts?: readonly CherryMarkPart[];
}

const ALL_PARTS: readonly CherryMarkPart[] = ["stalk", "cherries", "bigHeart", "smallHeart"];

/** Trazados del logo en sus unidades (`CHERRY_MARK_VIEWBOX`), para meterlos en un `<Svg>`. */
export function CherryMarkShapes({ colors, parts = ALL_PARTS }: CherryMarkShapesProps) {
  const has = (part: CherryMarkPart) => parts.includes(part);

  return (
    <>
      {has("stalk") ? (
        <Path
          d={CHERRY_MARK_STALK_PATH}
          fill="none"
          stroke={colors.stem}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={CHERRY_MARK_STEM_WIDTH}
        />
      ) : null}
      {has("cherries") ? (
        <>
          <Path
            d={CHERRY_MARK_STEMS_PATH}
            fill="none"
            stroke={colors.stem}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={CHERRY_MARK_STEM_WIDTH}
          />
          {CHERRY_MARK_CHERRIES.map((cherry) => (
            <Circle cx={cherry.cx} cy={cherry.cy} fill={colors.cherry} key={cherry.cx} r={cherry.r} />
          ))}
          {colors.shine !== colors.cherry
            ? CHERRY_MARK_CHERRIES.map((cherry) => (
                <Path
                  d={cherry.shine}
                  fill="none"
                  key={cherry.cx}
                  stroke={colors.shine}
                  strokeLinecap="round"
                  strokeWidth={cherry.shineWidth}
                />
              ))
            : null}
        </>
      ) : null}
      {has("bigHeart") ? <Path d={CHERRY_MARK_BIG_HEART_PATH} fill={colors.leaf} /> : null}
      {has("smallHeart") ? <Path d={CHERRY_MARK_SMALL_HEART_PATH} fill={colors.leaf} /> : null}
    </>
  );
}

export interface CherryMarkProps {
  /** Alto en puntos (def. 48); el ancho sale de la proporción del dibujo. */
  size?: number;
  tone?: CherryMarkTone;
  /** Def. «Cherry». Con `decorative`, el lector de pantalla lo salta. */
  accessibilityLabel?: string;
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Logo de Cherry: un par de cerezas cuyas hojas son dos corazones. Dibujo plano, sin contornos
 * ni sombras; a color va sobre papel, blanco o el amarillo de marca.
 */
export const CherryMark = memo(function CherryMark({
  size = 48,
  tone = "color",
  accessibilityLabel = "Cherry",
  decorative = false,
  style,
  testID
}: CherryMarkProps) {
  const colors = useCherryMarkColors(tone);
  const width = cherryMarkWidth(size);

  return (
    <View
      accessible={!decorative}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : accessibilityLabel}
      importantForAccessibility={decorative ? "no-hide-descendants" : undefined}
      role={decorative ? undefined : "img"}
      style={[{ width, height: size }, style]}
      testID={testID}
    >
      <Svg height={size} viewBox={CHERRY_MARK_VIEWBOX} width={width}>
        <CherryMarkShapes colors={colors} />
      </Svg>
    </View>
  );
});
