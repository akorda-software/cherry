import { StyleSheet, View } from "react-native";

import { useTheme } from "../providers/theme-provider";

export function Divider({ label }: { label: string }) {
  const theme = useTheme();

  const styles = StyleSheet.create({
    divider: {
      borderTopWidth: theme.primitives.border.thin,
      borderTopColor: theme.semantic.border.subtle,
    },
  });

  return <View accessibilityLabel={label} role="separator" style={styles.divider} />;
}
