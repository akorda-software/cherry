import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../providers/theme-provider";

export function Stack({ children, style, ...props }: PropsWithChildren<{ style?: any }>) {
  const theme = useTheme();

  const stackStyle = StyleSheet.create({
    stack: {
      gap: theme.primitives.spacing.md,
    },
  });

  return (
    <View style={[stackStyle.stack, style]} {...props}>
      {children}
    </View>
  );
}
