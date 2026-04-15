import { StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../providers/theme-provider";
import { Button } from "./button";
import { Inline } from "./inline";

interface IconButtonProps {
  label: string;
  icon: string;
  disabled?: boolean;
  selected?: boolean;
  onPress?(): void;
}

export function IconButton({ disabled, icon, label, onPress, selected = false }: IconButtonProps) {
  const theme = useTheme();

  const styles = StyleSheet.create({
    button: {
      backgroundColor: selected ? theme.semantic.surface.selected : theme.semantic.surface.elevated,
    },
    icon: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.body.fontSize,
    },
    labelText: {
      color: theme.semantic.text.default,
      fontSize: theme.primitives.typography.body.fontSize,
    },
  });

  return (
    <Button disabled={disabled} onPress={onPress} style={styles.button} aria-pressed={selected}>
      <Inline>
        <RNText aria-hidden style={styles.icon}>{icon}</RNText>
        <RNText style={styles.labelText}>{label}</RNText>
      </Inline>
    </Button>
  );
}
