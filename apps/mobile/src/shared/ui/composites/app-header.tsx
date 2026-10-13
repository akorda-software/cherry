import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Heading } from "../primitives/heading";
import { Text } from "../primitives/text";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/** @deprecated usa `TopBar`. Se mantiene para código antiguo. */
export function AppHeader({ actions, subtitle, title }: AppHeaderProps) {
  return (
    <View role="banner" style={styles.banner}>
      <View style={styles.texts}>
        <Heading level={1}>{title}</Heading>
        {subtitle ? <Text color="muted">{subtitle}</Text> : null}
      </View>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 8
  },
  texts: {
    flex: 1,
    gap: 4
  }
});
