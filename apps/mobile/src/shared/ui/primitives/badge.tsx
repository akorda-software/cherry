import { type StyleProp, StyleSheet, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useOnChange, usePop } from "../motion/pop";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { Text } from "./text";

export interface BadgeProps {
  /** Número a mostrar; 0 o undefined no pinta nada (salvo `dot`). */
  count?: number;
  /** A partir de aquí muestra «99+». */
  max?: number;
  /** Solo un punto (novedad sin número). */
  dot?: boolean;
  color?: PastelName | "ink";
  size?: "sm" | "md";
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Contador pegatina (pestañas, avatares). Hace pop cuando cambia el número. */
export function Badge({ count, max = 99, dot = false, color = "fresa", size = "md", accessibilityLabel, style, testID }: BadgeProps) {
  const theme = useTheme();
  const { pop, style: popStyle } = usePop({ from: 1.25, tilt: 0 });
  const visible = dot || (count !== undefined && count > 0);

  useOnChange(count, (next, previous) => {
    if ((next ?? 0) > (previous ?? 0)) {
      pop();
    }
  });

  if (!visible) {
    return null;
  }

  const fill = color === "ink" ? theme.primitives.color.ink : theme.primitives.pastel[color].fill;
  const ink = color === "ink" ? theme.primitives.color.white : theme.primitives.color.ink;
  const height = size === "sm" ? 18 : 22;
  const label = count !== undefined && count > max ? `${max}+` : String(count ?? "");

  if (dot && !count) {
    const d = size === "sm" ? 10 : 12;

    return (
      <Animated.View
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.base,
          {
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: fill,
            borderColor: theme.primitives.color.ink,
            borderWidth: theme.primitives.border.thin
          },
          popStyle,
          style
        ]}
        testID={testID}
      />
    );
  }

  return (
    <Animated.View
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        {
          minWidth: height,
          height,
          borderRadius: height / 2,
          paddingHorizontal: size === "sm" ? 4 : 6,
          backgroundColor: fill,
          borderColor: theme.primitives.color.ink,
          borderWidth: theme.primitives.border.thin
        },
        popStyle,
        style
      ]}
      testID={testID}
    >
      <Text
        color={ink}
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: theme.primitives.fonts.black, fontSize: size === "sm" ? 10 : 12, lineHeight: size === "sm" ? 13 : 15 }}
        variant="caption"
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center"
  }
});
