import { Pressable, StyleSheet } from "react-native";

import { IconSlot } from "../primitives/icon-slot";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { useTheme } from "../providers/theme-provider";

interface NavListItemProps {
  label: string;
  description?: string;
  selected?: boolean;
  onPress(): void;
}

/** @deprecated usa `ListRow`. Se mantiene para código antiguo. */
export function NavListItem({ description, label, onPress, selected = false }: NavListItemProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      aria-current={selected ? "page" : undefined}
      onPress={onPress}
      style={[
        styles.row,
        {
          borderRadius: theme.primitives.radius.md,
          borderWidth: theme.primitives.border.regular,
          borderColor: theme.primitives.color.ink,
          backgroundColor: selected ? theme.semantic.surface.selected : theme.primitives.color.white
        }
      ]}
    >
      <Stack flex gap={2}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? (
          <Text color="muted" variant="caption">
            {description}
          </Text>
        ) : null}
      </Stack>
      <IconSlot color={theme.primitives.color.inkSoft} icon="chevron-right" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10
  }
});
