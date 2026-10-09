import { forwardRef, useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Divider, HardShadow, IconButton, Text, useTheme } from "../../../shared/ui";
import { MAX_MESSAGE_LENGTH, countCharacters, validateMessageBody } from "../domain/chat-messages";

/** En web el `textarea` nace con dos filas: que empiece en una, como en nativo. */
const WEB_SINGLE_ROW = (Platform.OS === "web" ? { rows: 1 } : {}) as Record<string, never>;

/** El contorno de tinta de la nota ya marca el foco: fuera el recuadro por defecto del navegador. */
const WEB_NO_OUTLINE = Platform.OS === "web" ? { outlineWidth: 0 } : null;

/** A partir de aquí se enseña el contador (suave; en tomate si te pasas). */
export const COUNTER_FROM = 1_600;

/** Sin separador de miles: en español los números de cuatro cifras van tal cual (1850). */
function formatCount(value: number): string {
  return String(value);
}

function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return open;
}

export interface ComposerProps {
  value: string;
  onChangeText(text: string): void;
  onSend(): void;
  placeholder: string;
  accessibilityLabel: string;
}

/**
 * Campo de mensaje tipo nota con botón de enviar. El botón se habilita con texto (1–2000) y el
 * contador aparece solo cerca del límite. Con el teclado abierto no deja hueco de safe area.
 */
export const Composer = forwardRef<TextInput, ComposerProps>(function Composer(
  { value, onChangeText, onSend, placeholder, accessibilityLabel },
  ref
) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const length = countCharacters(value);
  const tooLong = length > MAX_MESSAGE_LENGTH;
  const canSend = validateMessageBody(value).ok;
  const showCounter = length >= COUNTER_FROM;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.semantic.color.screenBackground,
          paddingBottom: (keyboardOpen ? 0 : insets.bottom) + 10
        }
      ]}
      testID="chat-composer"
    >
      <Divider />
      <View style={styles.row}>
        <HardShadow
          elevation="sm"
          style={[
            styles.note,
            {
              backgroundColor: c.white,
              borderColor: tooLong ? theme.semantic.state.danger : c.ink,
              borderWidth: theme.primitives.border.regular,
              borderRadius: theme.primitives.radius.md
            }
          ]}
        >
          <TextInput
            accessibilityHint={
              showCounter ? `${formatCount(length)} de ${formatCount(MAX_MESSAGE_LENGTH)} caracteres` : undefined
            }
            accessibilityLabel={accessibilityLabel}
            maxFontSizeMultiplier={1.4}
            multiline
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.semantic.text.faint}
            ref={ref}
            selectionColor={c.fresaDeep}
            style={[
              styles.input,
              WEB_NO_OUTLINE,
              {
                color: c.ink,
                fontFamily: theme.primitives.fonts.medium,
                fontSize: theme.primitives.text.body.fontSize,
                lineHeight: theme.primitives.text.body.lineHeight
              }
            ]}
            submitBehavior="newline"
            testID="chat-input"
            {...WEB_SINGLE_ROW}
            textAlignVertical="center"
            value={value}
          />
          {showCounter ? (
            <Text color={tooLong ? "danger" : "faint"} style={styles.counter} testID="chat-counter" variant="caption">
              {formatCount(length)} / {formatCount(MAX_MESSAGE_LENGTH)}
            </Text>
          ) : null}
        </HardShadow>
        <IconButton
          accessibilityHint={canSend ? undefined : "Escribe algo para poder enviarlo"}
          accessibilityLabel="Enviar mensaje"
          color="fresa"
          disabled={!canSend}
          icon="send"
          onPress={onSend}
          testID="chat-send"
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 12,
    gap: 10
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10
  },
  note: {
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 4
  },
  input: {
    maxHeight: 132,
    padding: 0,
    margin: 0,
    borderWidth: 0
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: 2,
    fontVariant: ["tabular-nums"]
  }
});
