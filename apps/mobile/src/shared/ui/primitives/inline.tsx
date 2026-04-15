import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../providers/theme-provider";

export function Inline({ children, style, ...props }: PropsWithChildren<{ style?: any }>) {
  const theme = useTheme();

  const inlineStyle = StyleSheet.create({
    inline: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.primitives.spacing.sm,
    },
  });

  return (
    <View style={[inlineStyle.inline, style]} {...props}>
      {children}
    </View>
  );
}
