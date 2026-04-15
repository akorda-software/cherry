import type { PropsWithChildren } from "react";
import { usePathname } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "../composites/app-header";
import { useTheme } from "../providers/theme-provider";
import { createContentWidth } from "../primitives/shared";
import { Stack } from "../primitives/stack";
import { getShellTitle } from "./routes";

interface ShellScaffoldProps {}

export function ShellScaffold({
  children
}: PropsWithChildren<ShellScaffoldProps>) {
  const pathname = usePathname();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.semantic.color.screenBackground
    },
    header: {
      ...createContentWidth(theme),
      paddingHorizontal: theme.primitives.spacing.lg,
      paddingTop: insets.top + theme.primitives.spacing.md
    },
    body: {
      flex: 1,
      minHeight: 0
    }
  });

  return (
    <View style={styles.root}>
      <Stack style={styles.body}>
        <View style={styles.header}>
          <AppHeader title={getShellTitle(pathname)} />
        </View>
        <View style={styles.body}>{children}</View>
      </Stack>
    </View>
  );
}
