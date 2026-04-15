import type { SessionUser } from "@snack/contracts";
import { StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { Card } from "../composites/card";

export function UserSummaryCard({ user }: { user: SessionUser }) {
  const theme = useTheme();

  const styles = StyleSheet.create({
    email: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.body.fontSize,
    },
  });

  return (
    <Card title={`Signed in as ${user.displayName ?? user.email}`}>
      <RNText style={styles.email}>{user.email}</RNText>
    </Card>
  );
}
