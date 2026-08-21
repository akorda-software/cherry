import { useMemo } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";

import { useTheme } from "../../../shared/ui";

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface MultiChoiceGroupProps<T extends string> {
  options: ReadonlyArray<ChoiceOption<T>>;
  values: ReadonlyArray<T>;
  onChange(values: T[]): void;
  testID?: string;
}

export function MultiChoiceGroup<T extends string>({
  options,
  values,
  onChange,
  testID
}: MultiChoiceGroupProps<T>) {
  const theme = useTheme();
  const valueSet = useMemo(() => new Set(values), [values]);

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
          flexGrow: 1
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
          letterSpacing: 0.4,
          textAlign: "center"
        }
      }),
    [theme]
  );

  return (
    <View style={styles.container} accessibilityRole="radiogroup" testID={testID}>
      {options.map((option) => {
        const selected = valueSet.has(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) {
                onChange(values.filter((v) => v !== option.value));
              } else {
                onChange([...values, option.value]);
              }
            }}
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
    </View>
  );
}
