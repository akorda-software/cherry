import type { PropsWithChildren } from "react";
import { StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../providers/theme-provider";

export function Text({ children, style, ...props }: PropsWithChildren<{ style?: any }>) {
  const theme = useTheme();

  const textStyle = StyleSheet.create({
    text: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.body.fontSize,
      fontWeight: theme.primitives.typography.body.fontWeight as any,
      margin: 0,
    },
  });

  return (
    <RNText style={[textStyle.text, style]} {...props}>
      {children}
    </RNText>
  );
}
