import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import type { IconName } from "../art";
import { useTheme } from "../providers/theme-provider";
import type { PastelName } from "../tokens/primitives/color";
import { IconSlot } from "./icon-slot";
import { Text } from "./text";

export type PillColor = PastelName | "white" | "ink";

export interface PillProps {
  label: string;
  icon?: IconName;
  /** Relleno de la insignia (por defecto blanco). */
  color?: PillColor;
  size?: "sm" | "md";
  rotate?: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Insignia pequeña con icono: el sistema de avisos de Snack (Nuevo · Te dio
 * like · En común · Un poco más lejos). Úsala en vez de texto suelto.
 */
export function Pill({ label, icon, color = "white", size = "md", rotate, accessibilityLabel, testID, style }: PillProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const height = size === "sm" ? 24 : 28;
  const fill = color === "white" ? c.white : color === "ink" ? c.ink : theme.primitives.pastel[color].fill;
  const ink = color === "ink" ? c.white : c.ink;

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? label}
      accessible
      accessibilityRole="text"
      style={[
        styles.pill,
        {
          height,
          borderRadius: height / 2,
          paddingHorizontal: size === "sm" ? 8 : 10,
          gap: size === "sm" ? 4 : 5,
          borderWidth: theme.primitives.border.thin,
          borderColor: c.ink,
          backgroundColor: fill
        },
        theme.primitives.elevation.xs,
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style
      ]}
      testID={testID}
    >
      {icon ? <IconSlot color={ink} icon={icon} size={size === "sm" ? 13 : 15} /> : null}
      <Text
        color={ink}
        maxFontSizeMultiplier={1.25}
        numberOfLines={1}
        style={{
          fontFamily: theme.primitives.fonts.extraBold,
          fontSize: size === "sm" ? 11.5 : 13,
          lineHeight: size === "sm" ? 15 : 17
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center"
  }
});
