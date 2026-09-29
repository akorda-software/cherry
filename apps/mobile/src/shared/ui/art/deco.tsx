import { memo, type ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { circle, HEART, SPARKLE, STAR } from "./icon-paths";

export type DecoKind = "sparkle" | "star" | "heart" | "circle" | "dot" | "bubble" | "bow" | "flower";

export const decoKinds: DecoKind[] = ["sparkle", "star", "heart", "circle", "dot", "bubble", "bow", "flower"];

export interface DecoProps {
  kind: DecoKind;
  /** Lado en puntos (def. 24). */
  size?: number;
  /** Relleno pastel (def. limonada; `dot` es siempre tinta). */
  color?: PastelName;
  /** Giro en grados. */
  rotation?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const FLOWER =
  "M8 6.49A4.05 4.05 0 1 1 16 6.49A4.05 4.05 0 1 1 18.48 14.1A4.05 4.05 0 1 1 12 18.81A4.05 4.05 0 1 1 5.52 14.1A4.05 4.05 0 1 1 8 6.49Z";
const BOW_LEFT = "M11 10.6C9 8.2 6 6.5 4.4 7.5 2.9 8.5 2.9 13.4 4.4 14.5 6 15.6 9 14.2 11 12.9Z";
const BOW_RIGHT = "M13 10.6C15 8.2 18 6.5 19.6 7.5 21.1 8.5 21.1 13.4 19.6 14.5 18 15.6 15 14.2 13 12.9Z";

/**
 * Decoración geométrica para esquinas y bordes (nunca encima de caras ni texto):
 * destello de 4 puntas, estrella, corazón, círculo, punto, burbuja, lazo, flor.
 * Siempre contorno de tinta y relleno pastel.
 */
export const Deco = memo(function Deco({ kind, size = 24, color = "limonada", rotation = 0, style, testID }: DecoProps) {
  const theme = useTheme();
  const ink = theme.primitives.color.ink;
  const fill = theme.primitives.pastel[color].fill;
  // Contorno óptico: ~2.4 px reales, entre 1.75 y 3.
  const sw = (Math.min(Math.max((2.4 * size) / 28, 1.75), 3) * 24) / size;
  const line = { stroke: ink, strokeWidth: sw, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  let content: ReactNode;
  switch (kind) {
    case "sparkle":
      content = <Path d={SPARKLE} fill={fill} {...line} />;
      break;
    case "star":
      content = <Path d={STAR} fill={fill} {...line} />;
      break;
    case "heart":
      content = <Path d={HEART} fill={fill} {...line} />;
      break;
    case "circle":
      content = <Circle cx={12} cy={12} r={8} fill={fill} {...line} />;
      break;
    case "dot":
      content = <Circle cx={12} cy={12} r={5} fill={ink} />;
      break;
    case "bubble":
      content = (
        <G>
          <Circle cx={12} cy={12} r={8.5} fill={fill} {...line} />
          <Path d="M7.6 11.2a4.8 4.8 0 0 1 3.4-3.7" stroke={theme.primitives.color.white} strokeWidth={2.2} strokeLinecap="round" fill="none" />
        </G>
      );
      break;
    case "bow":
      content = (
        <G>
          <Path d="M11 14.2 8.6 19.4M13 14.2l2.4 5.2" stroke={ink} strokeWidth={4 + sw * 2} strokeLinecap="round" fill="none" />
          <Path d="M11 14.2 8.6 19.4M13 14.2l2.4 5.2" stroke={fill} strokeWidth={4} strokeLinecap="round" fill="none" />
          <Path d={BOW_LEFT} fill={fill} {...line} />
          <Path d={BOW_RIGHT} fill={fill} {...line} />
          <Path d={circle(12, 11.75, 2.35)} fill={fill} {...line} />
        </G>
      );
      break;
    case "flower":
      content = (
        <G>
          <Path d={FLOWER} fill={fill} {...line} />
          <Circle cx={12} cy={12} r={2.6} fill={theme.primitives.color.limonada} {...line} />
        </G>
      );
      break;
  }

  return (
    <View
      testID={testID}
      aria-hidden
      style={[{ width: size, height: size, pointerEvents: "none", transform: [{ rotate: `${rotation}deg` }] }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {content}
      </Svg>
    </View>
  );
});

export interface SparkleProps extends Omit<DecoProps, "kind"> {}

/** Destello de 4 puntas (atajo de `<Deco kind="sparkle" />`). */
export function Sparkle(props: SparkleProps) {
  return <Deco kind="sparkle" {...props} />;
}
