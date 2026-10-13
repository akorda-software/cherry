import { memo } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import { type IconName, iconPaths, solidByDefault } from "./icon-paths";

export type { IconName } from "./icon-paths";
export { iconNames } from "./icon-paths";

export interface IconProps {
  name: IconName;
  /** Lado en puntos. Pensado para 16, 20, 24, 32 y 48. */
  size?: number;
  /** Color de la tinta (trazo). Por defecto `semantic.icon.default`. */
  color?: string;
  /** Relleno pastel de las formas cerradas (tinta siempre encima). */
  fill?: string;
  /** Grosor en unidades de la retícula de 24. Por defecto, óptico según el tamaño. */
  strokeWidth?: number;
  /** Si se pasa, el icono se anuncia como imagen; si no, es decorativo y se oculta. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const BASE_STROKE = 2.25;
const MIN_STROKE_PX = 1.6;
const MAX_STROKE_PX = 3.6;

/**
 * Grosor óptico: 2.25 en la retícula de 24, pero nunca por debajo de 1.6 px
 * (a 16 px se perdería) ni por encima de 3.6 px (a 48 px empastaría).
 */
export function opticalStrokeWidth(size: number): number {
  const px = (BASE_STROKE * size) / 24;
  const clamped = Math.min(Math.max(px, MIN_STROKE_PX), MAX_STROKE_PX);
  return Math.round(((clamped * 24) / size) * 1000) / 1000;
}

/**
 * Icono del sistema: SVG propio, trazo de tinta redondeado y relleno pastel
 * opcional. Es el único set de iconos de la interfaz (nada de emoji ni fuentes
 * de iconos).
 *
 * `<Icon name="heart" size={24} fill={theme.primitives.color.fresa} />`
 */
export const Icon = memo(function Icon({
  name,
  size = 24,
  color,
  fill,
  strokeWidth,
  accessibilityLabel,
  style,
  testID
}: IconProps) {
  const theme = useTheme();
  const ink = color ?? theme.semantic.icon.default;
  const parts = iconPaths[name] ?? iconPaths.help;
  const width = strokeWidth ?? opticalStrokeWidth(size);
  const fillColor = fill ?? (solidByDefault.has(name) ? ink : undefined);

  const svg = (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {parts.map((part, index) =>
        "solid" in part && part.solid ? (
          <Path key={index} d={part.d} fill={ink} />
        ) : (
          <Path
            key={index}
            d={part.d}
            fill={"fillable" in part && part.fillable && fillColor ? fillColor : "none"}
            stroke={ink}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      )}
    </Svg>
  );

  const labelled = Boolean(accessibilityLabel);

  return (
    <View
      testID={testID}
      style={[{ width: size, height: size, pointerEvents: "none" }, style]}
      accessible={labelled ? true : undefined}
      role={labelled ? "img" : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={!labelled}
    >
      {svg}
    </View>
  );
});
