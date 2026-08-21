import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { useTheme } from "../../../shared/ui";

interface DatePickerFieldProps {
  value: string | null;
  onChange(isoDate: string): void;
  maximumDate?: Date;
  minimumDate?: Date;
  placeholder?: string;
  testID?: string;
}

function parseIsoOrNull(value: string | null): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const fallback = new Date();
  fallback.setFullYear(fallback.getFullYear() - 25);
  return fallback;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatReadable(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function DatePickerField({
  value,
  onChange,
  maximumDate,
  minimumDate,
  placeholder = "Elegí una fecha",
  testID
}: DatePickerFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const current = useMemo(() => parseIsoOrNull(value), [value]);

  const handlePress = useCallback(() => setOpen(true), []);

  const handleChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setOpen(false);
      if (date) {
        onChange(toIsoDate(date));
      }
    },
    [onChange]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        field: {
          backgroundColor: theme.semantic.color.surfaceBackground,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          borderRadius: theme.primitives.radius.sm,
          paddingHorizontal: theme.primitives.spacing.md,
          paddingVertical: theme.primitives.spacing.sm,
          minHeight: theme.primitives.size.buttonHeight,
          justifyContent: "center"
        },
        pressed: {
          transform: [{ translateY: 2 }]
        },
        label: {
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: "600" as any,
          color: value ? theme.semantic.text.default : "#9B9583"
        }
      }),
    [theme, value]
  );

  return (
    <View>
      <Pressable
        testID={testID}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        accessibilityValue={{ text: value ? formatReadable(current) : "Sin fecha" }}
        style={({ pressed }) => [styles.field, pressed ? styles.pressed : null]}
      >
        <RNText style={styles.label}>{value ? formatReadable(current) : placeholder}</RNText>
      </Pressable>

      {open ? (
        <DateTimePicker
          mode="date"
          display="spinner"
          value={current}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  );
}
