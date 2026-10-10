import type { SessionUser } from "@cherry/contracts";
import { StyleSheet, View } from "react-native";

import { Card } from "../composites/card";
import { Avatar } from "../primitives/avatar";
import { Text } from "../primitives/text";

/** Tarjeta de la cuenta con sesión iniciada (avatar + nombre + email). */
export function UserSummaryCard({ user }: { user: SessionUser }) {
  const name = user.displayName ?? user.email;

  return (
    <Card>
      <View style={styles.row}>
        <Avatar name={name} size="md" />
        <View style={styles.texts}>
          <Text numberOfLines={1} variant="title3">
            {name}
          </Text>
          <Text color="muted" numberOfLines={1} variant="caption">
            {user.email}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  texts: {
    flex: 1,
    gap: 2
  }
});
