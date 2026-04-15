import { StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { Stack } from "./stack";
import { Surface } from "./surface";

interface UserBadgeProps {
  name: string;
  email?: string;
  selected?: boolean;
}

export function UserBadge({ email, name, selected = false }: UserBadgeProps) {
  const theme = useTheme();
  const accessibilityLabel = selected ? `${name}, selected user badge` : `${name} user badge`;

  const styles = StyleSheet.create({
    name: {
      color: theme.semantic.text.default,
      fontWeight: "700" as any,
      fontSize: theme.primitives.typography.body.fontSize,
    },
    email: {
      color: theme.semantic.text.muted,
      fontSize: theme.primitives.typography.body.fontSize,
    },
  });

  return (
    <Surface accessibilityLabel={accessibilityLabel} tone={selected ? "selected" : "base"}>
      <Stack>
        <RNText style={styles.name}>{name}</RNText>
        {email ? <RNText style={styles.email}>{email}</RNText> : null}
      </Stack>
    </Surface>
  );
}
