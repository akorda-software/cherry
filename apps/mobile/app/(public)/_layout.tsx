import type { PropsWithChildren } from "react";
import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../../src/shared/ui/providers/theme-provider";

/** Zona pública (login). Cada pantalla gestiona su safe area con `Screen`. */
export function PublicLayout({ children }: PropsWithChildren) {
  const theme = useTheme();

  if (children) {
    return <View style={[styles.root, { backgroundColor: theme.semantic.color.screenBackground }]}>{children}</View>;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.semantic.color.screenBackground }
      }}
    />
  );
}

export default function PublicLayoutRoute() {
  return <PublicLayout />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
});
