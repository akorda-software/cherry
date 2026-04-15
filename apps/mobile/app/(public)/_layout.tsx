import type { PropsWithChildren } from "react";
import { Slot } from "expo-router";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../src/shared/ui/providers/theme-provider";

export function PublicLayout({ children }: PropsWithChildren) {
  const theme = useTheme();

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.semantic.color.screenBackground
    }
  });

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.root}>
      {children ?? <Slot />}
    </SafeAreaView>
  );
}

export default function PublicLayoutRoute() {
  return <PublicLayout />;
}
