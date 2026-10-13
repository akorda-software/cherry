import { type StyleProp, View, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";

import { useTheme } from "../providers/theme-provider";

export interface DividerProps {
  /** Nombre accesible del separador. */
  label?: string;
  /** Color del trazo (por defecto, puntos del papel). */
  color?: string;
  /** Línea continua en lugar de discontinua. */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Línea discontinua de libreta. */
export function Divider({ label, color, solid = false, style }: DividerProps) {
  const theme = useTheme();
  const stroke = color ?? theme.primitives.color.dot;
  const thickness = theme.primitives.border.thin;

  return (
    <View accessibilityLabel={label} role="separator" style={[{ height: thickness, alignSelf: "stretch" }, style]}>
      <Svg height={thickness} width="100%">
        <Line
          stroke={stroke}
          strokeDasharray={solid ? undefined : "6 6"}
          strokeLinecap="round"
          strokeWidth={thickness}
          x1={thickness}
          x2="100%"
          y1={thickness / 2}
          y2={thickness / 2}
        />
      </Svg>
    </View>
  );
}
