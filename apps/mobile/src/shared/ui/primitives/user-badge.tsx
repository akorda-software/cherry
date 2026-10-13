import { StyleSheet, View } from "react-native";

import { Avatar } from "./avatar";
import { Surface } from "./surface";
import { Text } from "./text";

interface UserBadgeProps {
  name: string;
  email?: string;
  selected?: boolean;
  avatarUrl?: string | null;
}

/** Ficha compacta de persona (avatar + nombre + dato). */
export function UserBadge({ email, name, selected = false, avatarUrl }: UserBadgeProps) {
  const accessibilityLabel = selected ? `${name}, seleccionado` : name;

  return (
    <Surface accessibilityLabel={accessibilityLabel} color={selected ? "limonada" : "white"} elevation="sm" padding={12}>
      <View style={styles.row}>
        <Avatar name={name} size="sm" uri={avatarUrl} />
        <View style={styles.texts}>
          <Text variant="bodyStrong">{name}</Text>
          {email ? (
            <Text color="muted" variant="caption">
              {email}
            </Text>
          ) : null}
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  texts: {
    flex: 1,
    gap: 2
  }
});
