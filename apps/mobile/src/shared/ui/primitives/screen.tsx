import type { PropsWithChildren } from "react";
import { StyleSheet, Text as RNText, View } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { createContentWidth } from "./shared";

interface ScreenProps extends PropsWithChildren {
  testId?: string;
  title?: string;
  description?: string;
}

export function Screen({ children, description, testId, title }: ScreenProps) {
  const theme = useTheme();

  const styles = StyleSheet.create({
    root: {
      ...createContentWidth(theme),
      backgroundColor: theme.semantic.color.screenBackground,
      gap: theme.primitives.spacing.lg,
      padding: theme.primitives.spacing.lg,
    },
    title: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.title.fontSize,
      fontWeight: theme.primitives.typography.title.fontWeight as any,
    },
    desc: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.body.fontSize,
      fontWeight: theme.primitives.typography.body.fontWeight as any,
    },
  });

  return (
    <View style={styles.root} testID={testId}>
      {title ? <RNText role="heading" aria-level={1} style={styles.title}>{title}</RNText> : null}
      {description ? <RNText style={styles.desc}>{description}</RNText> : null}
      {children}
    </View>
  );
}
