import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { TextInput as RNTextInput } from "react-native";

import { useTheme } from "../../../shared/ui";

interface TextFieldProps {
  value: string;
  onChangeText(text: string): void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  testID?: string;
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  maxLength,
  keyboardType = "default",
  secureTextEntry,
  autoCapitalize = "none",
  testID
}: TextFieldProps) {
  const theme = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        input: {
          backgroundColor: theme.semantic.color.surfaceBackground,
          borderWidth: theme.primitives.border.bold,
          borderColor: theme.primitives.color.ink,
          borderRadius: theme.primitives.radius.sm,
          paddingHorizontal: theme.primitives.spacing.md,
          paddingVertical: theme.primitives.spacing.sm,
          fontSize: theme.primitives.typography.body.fontSize,
          fontWeight: "600" as any,
          color: theme.semantic.text.default,
          minHeight: theme.primitives.size.buttonHeight
        },
        inputMultiline: {
          minHeight: (theme.primitives.size.buttonHeight ?? 48) * (numberOfLines ?? 3),
          textAlignVertical: "top"
        }
      }),
    [numberOfLines, theme]
  );

  return (
    <RNTextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9B9583"
      multiline={multiline}
      numberOfLines={numberOfLines}
      maxLength={maxLength}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      style={[styles.input, multiline ? styles.inputMultiline : null]}
    />
  );
}
