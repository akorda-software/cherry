import type { PropsWithChildren } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

import { IconSlot } from "../primitives/icon-slot";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";

interface FormMessageProps extends PropsWithChildren {
  tone: "info" | "success" | "error";
  style?: StyleProp<ViewStyle>;
}

/** Aviso corto de formulario (icono + texto). Los errores se anuncian. */
export function FormMessage({ children, tone, style }: FormMessageProps) {
  const theme = useTheme();
  const color =
    tone === "error" ? theme.semantic.state.danger : tone === "success" ? theme.semantic.state.success : theme.semantic.state.info;
  const icon = tone === "error" ? "alert" : tone === "success" ? "check-circle" : "info";

  return (
    <View
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      role={tone === "error" ? "alert" : "status"}
      style={[styles.row, style]}
    >
      <IconSlot color={color} icon={icon} size={18} />
      <Text color={color} style={styles.text} variant="callout">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8
  },
  text: {
    flex: 1
  }
});
