import { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText } from "react-native";

import { useTheme } from "../../../shared/ui";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface ChoiceGroupProps<T extends string> {
  options: ReadonlyArray<ChoiceOption<T>>;
  value: T | null;
  onChange(value: T): void;
  columns?: 1 | 2;
  testID?: string;
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 1,
  testID
}: ChoiceGroupProps<T>) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: theme.primitives.spacing.sm
        },
        chip: {
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          borderRadius: theme.primitives.radius.pill,
          paddingVertical: theme.primitives.spacing.sm,
          paddingHorizontal: theme.primitives.spacing.md,
          backgroundColor: theme.semantic.color.surfaceBackground,
          flexGrow: columns === 1 ? 1 : 0,
          flexBasis: columns === 2 ? "47%" : "auto",
          alignItems: "center"
        },
        chipSelected: {
          backgroundColor: theme.semantic.surface.selected,
          ...theme.primitives.elevation.sm
        },
        label: {
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: "700" as any,
          color: theme.semantic.text.default,
          textTransform: "uppercase" as any,
          letterSpacing: 0.4
        }
      }),
    [columns, theme]
  );

  return (
    <Pressable
      testID={testID}
      style={styles.container}
      accessibilityRole="radiogroup"
      onPress={() => {}}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : null,
              pressed ? { transform: [{ translateY: 2 }] } : null
            ]}
          >
            <RNText style={styles.label}>{option.label}</RNText>
          </Pressable>
        );
      })}
    </Pressable>
  );
}
