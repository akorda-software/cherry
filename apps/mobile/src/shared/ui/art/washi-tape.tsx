import { memo, type ReactNode, useId } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { mixHex, svgSafeId } from "./color-utils";
import { HEART } from "./icon-paths";

export type WashiPattern = "dots" | "stripes" | "grid" | "hearts" | "plain";

export const washiPatterns: WashiPattern[] = ["dots", "stripes", "grid", "hearts", "plain"];

export interface WashiTapeProps {
  /** Largo de la tira en puntos (def. 96). */
  width?: number;
  /** Ancho de la cinta (def. 26). */
  height?: number;
  color?: PastelName;
  pattern?: WashiPattern;
  /** Giro en grados (p. ej. -35 en una esquina). */
  rotation?: number;
  /** Contorno fino de tinta (def. sí). */
  outlined?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Contorno de la tira con los extremos cortados en zigzag (tijera dentada). */
export function washiPath(width: number, height: number): string {
  const depth = Math.min(3.5, height * 0.16);
  const teeth = Math.max(3, Math.round(height / 6));
  const step = height / (teeth * 2);
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M${r(depth)} 0H${r(width - depth)}`;
  for (let i = 1; i <= teeth * 2; i++) {
    d += `L${r(width - (i % 2 === 1 ? 0 : depth))} ${r(i * step)}`;
  }
  d += `H${r(depth)}`;
  for (let i = 1; i <= teeth * 2; i++) {
    d += `L${r(i % 2 === 1 ? 0 : depth)} ${r(height - i * step)}`;
  }
  return `${d}Z`;
}

/** Cinta washi semitransparente con motivo. Para pegar fotos y notas por los bordes. */
export const WashiTape = memo(function WashiTape({
  width = 96,
  height = 26,
  color = "lavanda",
  pattern = "dots",
  rotation = 0,
  outlined = true,
  style,
  testID
}: WashiTapeProps) {
  const theme = useTheme();
  const swatch = theme.primitives.pastel[color];
  const white = theme.primitives.color.white;
  const motif = color === "limonada" ? mixHex(swatch.fill, swatch.deep, 0.38) : white;
  const patternId = svgSafeId("washi", useId());
  const d = washiPath(width, height);

  let tile: ReactNode = null;
  let tileSize = 8;
  switch (pattern) {
    case "dots":
      tileSize = 9;
      tile = [
        <Circle key="a" cx={2.25} cy={2.25} r={1.6} fill={motif} />,
        <Circle key="b" cx={6.75} cy={6.75} r={1.6} fill={motif} />
      ];
      break;
    case "stripes":
      tileSize = 8;
      tile = <Path d="M-2 10 10 -2M-2 2 2 -2M6 10 10 6" stroke={motif} strokeWidth={2.4} />;
      break;
    case "grid":
      tileSize = 7;
      tile = <Path d="M0 0.5H7M0.5 0V7" stroke={motif} strokeWidth={1.1} />;
      break;
    case "hearts":
      tileSize = 12;
      tile = [
        <Path key="a" d={HEART} transform="translate(0.5 0.5) scale(0.24)" fill={motif} />,
        <Path key="b" d={HEART} transform="translate(6.5 6.5) scale(0.24)" fill={motif} />
      ];
      break;
    case "plain":
      tile = null;
      break;
  }

  return (
    <View
      testID={testID}
      aria-hidden
      style={[{ width, height, pointerEvents: "none", transform: [{ rotate: `${rotation}deg` }] }, style]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {tile ? (
          <Defs>
            <Pattern id={patternId} patternUnits="userSpaceOnUse" x={0} y={0} width={tileSize} height={tileSize}>
              {tile}
            </Pattern>
          </Defs>
        ) : null}
        <Path d={d} fill={swatch.fill} fillOpacity={0.86} />
        {tile ? <Path d={d} fill={`url(#${patternId})`} opacity={0.85} /> : null}
        {/* Brillo del papel: una franja más clara a lo largo. */}
        <Rect x={4} y={height * 0.14} width={Math.max(0, width - 8)} height={height * 0.12} fill={white} opacity={0.22} />
        {outlined ? (
          <Path
            d={d}
            fill="none"
            stroke={theme.primitives.color.ink}
            strokeWidth={theme.primitives.border.hairline}
            strokeLinejoin="round"
            strokeOpacity={0.9}
          />
        ) : null}
      </Svg>
    </View>
  );
});
