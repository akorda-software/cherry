import { useRef } from "react";
import { StyleSheet, type TextInput, View } from "react-native";

import { Stack, Text, TextField } from "../../../../shared/ui";
import { type BirthdayPart, type BirthdayParts, normalizeBirthdayPart } from "../../domain/birthday";

export interface BirthdayFieldProps {
  value: BirthdayParts;
  onChange(next: BirthdayParts): void;
  /** Error de la fecha completa (menor de edad, no existe…). */
  error?: string | null;
  autoFocus?: boolean;
  onComplete?(): void;
  testID?: string;
}

const PARTS: ReadonlyArray<{ part: BirthdayPart; label: string; placeholder: string; flex: number; maxLength: number }> = [
  { part: "day", label: "Día", placeholder: "DD", flex: 1, maxLength: 2 },
  { part: "month", label: "Mes", placeholder: "MM", flex: 1, maxLength: 2 },
  { part: "year", label: "Año", placeholder: "AAAA", flex: 1.6, maxLength: 4 }
];

/**
 * Fecha en tres casillas con teclado numérico: al completar una salta sola a la
 * siguiente (un «7» en el día ya es «07») y borrar en una vacía vuelve atrás.
 * Más rápido que cualquier selector de fecha.
 */
export function BirthdayField({ value, onChange, error, autoFocus = false, onComplete, testID = "onboarding-birthday" }: BirthdayFieldProps) {
  const refs = useRef<Record<BirthdayPart, TextInput | null>>({ day: null, month: null, year: null });

  const focus = (part: BirthdayPart | undefined) => {
    if (part) {
      refs.current[part]?.focus();
    }
  };

  const handleChange = (part: BirthdayPart, index: number, raw: string) => {
    const { value: normalized, complete } = normalizeBirthdayPart(part, raw);
    const next = { ...value, [part]: normalized };
    onChange(next);

    if (complete && normalized !== value[part]) {
      const following = PARTS[index + 1]?.part;

      if (following) {
        focus(following);
      } else {
        onComplete?.();
      }
    }
  };

  return (
    <Stack gap="xs">
      <View style={styles.row}>
        {PARTS.map(({ part, label, placeholder, flex, maxLength }, index) => {
          return (
            <View key={part} style={{ flex }}>
              <Text color="muted" style={styles.label} variant="label">
                {label}
              </Text>
              <TextField
                accessibilityLabel={label}
                autoFocus={autoFocus && index === 0}
                color="limonada"
                counter={false}
                inputStyle={styles.input}
                keyboardType="number-pad"
                maxLength={maxLength}
                onChangeText={(text) => handleChange(part, index, text)}
                onKeyPress={(event) => {
                  if (event.nativeEvent.key === "Backspace" && value[part] === "" && index > 0) {
                    focus(PARTS[index - 1].part);
                  }
                }}
                placeholder={placeholder}
                ref={(input) => {
                  refs.current[part] = input;
                }}
                returnKeyType={index === PARTS.length - 1 ? "done" : "next"}
                selectTextOnFocus
                size="xl"
                testID={`${testID}-${part}`}
                value={value[part]}
              />
            </View>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" color="danger" role="alert" variant="callout">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12
  },
  label: {
    marginBottom: 6
  },
  input: {
    textAlign: "center",
    letterSpacing: 1
  }
});
