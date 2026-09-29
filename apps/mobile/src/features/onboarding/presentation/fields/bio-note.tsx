import { useRef } from "react";
import { Platform, StyleSheet, TextInput, type TextStyle, View } from "react-native";

import { Button, Inline, StickyNote, Stack, Text, useTheme } from "../../../../shared/ui";
import { BIO_MAX, BIO_MIN, BIO_STARTERS, bioLength, insertBioStarter } from "../../domain/profile-fields";

export interface BioNoteProps {
  value: string;
  onChange(next: string): void;
  error?: string | null;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * La bio como una nota adhesiva grande escrita «a mano», con contador y
 * arranques de inspiración que se añaden al final.
 */
export function BioNote({ value, onChange, error, autoFocus = false, testID = "bio-note" }: BioNoteProps) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const input = useRef<TextInput>(null);
  const length = bioLength(value);
  const missing = Math.max(0, BIO_MIN - length);

  const addStarter = (starter: string) => {
    const next = insertBioStarter(value, starter);
    onChange(next);
    requestAnimationFrame(() => {
      const node = input.current as unknown as
        | (TextInput & { setSelection?: (start: number, end: number) => void; setSelectionRange?: (start: number, end: number) => void })
        | null;
      node?.focus();
      // El cursor al final, justo después del arranque (en web, `setSelectionRange` del <textarea>).
      if (node?.setSelection) node.setSelection(next.length, next.length);
      else node?.setSelectionRange?.(next.length, next.length);
    });
  };

  return (
    <Stack gap="lg">
      <StickyNote color="limonada" padding={18} tape={{ color: "fresa", pattern: "hearts" }} testID={`${testID}-paper`} tilt={-1.2}>
        <TextInput
          accessibilityHint={`Entre ${BIO_MIN} y ${BIO_MAX} caracteres`}
          accessibilityLabel="Tu bio"
          autoFocus={autoFocus}
          cursorColor={c.ink}
          maxFontSizeMultiplier={1.3}
          maxLength={BIO_MAX}
          multiline
          onChangeText={onChange}
          placeholder="Escribe aquí algo que te represente…"
          placeholderTextColor={theme.semantic.text.faint}
          ref={input}
          selectionColor={c.fresaDeep}
          style={[
            styles.input,
            {
              fontFamily: theme.primitives.fonts.hand,
              color: theme.semantic.text.default
            }
          ]}
          testID={`${testID}-input`}
          textAlignVertical="top"
          value={value}
        />
        <View style={styles.meta}>
          <Text color={missing > 0 ? "muted" : "success"} variant="caption">
            {missing > 0 ? (missing === 1 ? "Te falta 1 carácter" : `Te faltan ${missing} caracteres`) : "¡Así da gusto!"}
          </Text>
          <Text color={length >= BIO_MAX ? "danger" : "muted"} testID={`${testID}-counter`} variant="caption">
            {`${length}/${BIO_MAX}`}
          </Text>
        </View>
      </StickyNote>

      {error ? (
        <Text color="danger" role="alert" variant="callout">
          {error}
        </Text>
      ) : null}

      <Stack gap="sm">
        <Text color="muted" variant="label">
          ¿Te atascas? Empieza por aquí:
        </Text>
        <Inline gap="sm">
          {BIO_STARTERS.map((starter, index) => (
            <Button
              icon="sparkle"
              key={starter}
              onPress={() => addStarter(starter)}
              size="sm"
              testID={`${testID}-starter-${index}`}
              variant="secondary"
            >
              {starter}
            </Button>
          ))}
        </Inline>
      </Stack>
    </Stack>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 168,
    fontSize: 21,
    lineHeight: 29,
    padding: 0,
    // Por encima del papel de la nota (en web el SVG absoluto se pinta sobre lo no posicionado).
    position: "relative",
    zIndex: 1,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as unknown as TextStyle) : null)
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10
  }
});
