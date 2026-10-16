import { memo, useCallback, useRef, useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";

import { FormMessage, Icon, Inline, PressableScale, Stack, Text, TextField, useTheme } from "../../../../shared/ui";
import { BIO_MAX, BIO_MIN, BIO_STARTERS, bioLength, insertBioStarter } from "../../domain/profile-fields";

export interface BioNoteProps {
  value: string;
  /** Reuse the form validation's grapheme count instead of scanning the text twice. */
  length?: number;
  onChange(next: string): void;
  error?: string | null;
  editable?: boolean;
  autoFocus?: boolean;
  testID?: string;
}

/**
 * Alto fijo del campo: el texto se desplaza dentro y el campo nunca crece por
 * debajo del teclado. En pantallas bajas, algo menos para que quepa entero
 * entre el título y el teclado.
 */
const FIELD_HEIGHT = 188;
const FIELD_HEIGHT_COMPACT = 154;
const COMPACT_WINDOW = 720;

type SelectableInput = TextInput & {
  setSelection?: (start: number, end: number) => void;
  setSelectionRange?: (start: number, end: number) => void;
};

/**
 * La bio como un campo grande de libreta (contorno gordo y sombra dura), con
 * el contador en vivo debajo y, aparte y plegadas, ideas opcionales para
 * empezar que se añaden al final del texto.
 */
export function BioNote({ value, length, onChange, error, editable = true, autoFocus = false, testID = "bio-note" }: BioNoteProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  // Refs para que las ideas no se vuelvan a pintar con cada tecla.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const editableRef = useRef(editable);
  valueRef.current = value;
  onChangeRef.current = onChange;
  editableRef.current = editable;

  const fieldHeight = windowHeight < COMPACT_WINDOW ? FIELD_HEIGHT_COMPACT : FIELD_HEIGHT;

  const addStarter = useCallback((starter: string) => {
    if (!editableRef.current) return;
    const next = insertBioStarter(valueRef.current, starter);
    onChangeRef.current(next);
    requestAnimationFrame(() => {
      const node = input.current as SelectableInput | null;
      node?.focus();
      // El cursor al final, justo después de la idea (en web, `setSelectionRange` del <textarea>).
      if (node?.setSelection) node.setSelection(next.length, next.length);
      else node?.setSelectionRange?.(next.length, next.length);
    });
  }, []);

  return (
    <Stack gap="lg">
      <View>
        <TextField
          accessibilityHint={`Mínimo ${BIO_MIN} caracteres, máximo ${BIO_MAX}.`}
          accessibilityLabel="Tu descripción"
          autoCapitalize="sentences"
          autoFocus={autoFocus}
          counter={false}
          editable={editable}
          inputStyle={[
            styles.input,
            {
              fontFamily: theme.primitives.fonts.medium,
              height: fieldHeight,
              minHeight: fieldHeight
            }
          ]}
          maxLength={BIO_MAX}
          multiline
          onChangeText={onChange}
          placeholder="A qué te dedicas, qué te gusta hacer, qué buscas…"
          ref={input}
          scrollEnabled
          size="xl"
          testID={`${testID}-input`}
          value={value}
        />
        <BioMeter length={length ?? bioLength(value)} testID={testID} />
      </View>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}

      <BioIdeas editable={editable} onPick={addStarter} testID={testID} />
    </Stack>
  );
}

/** «Mínimo 20» (con ✓ al llegar) y «n/240». Solo esto cambia al escribir. */
function BioMeter({ length, testID }: { length: number; testID: string }) {
  const theme = useTheme();
  const reached = length >= BIO_MIN;
  const full = length >= BIO_MAX;
  const missing = BIO_MIN - length;

  return (
    <View style={styles.meter}>
      <View
        accessibilityLabel={
          reached
            ? `Mínimo de ${BIO_MIN} caracteres cumplido`
            : `Faltan ${missing} ${missing === 1 ? "carácter" : "caracteres"} para el mínimo de ${BIO_MIN}`
        }
        accessible
        style={styles.minimum}
        testID={`${testID}-minimum`}
      >
        <Text color={reached ? "success" : "muted"} variant="caption">
          {`Mínimo ${BIO_MIN}`}
        </Text>
        {reached ? <Icon color={theme.semantic.state.success} name="check" size={16} /> : null}
      </View>
      <Text
        accessibilityLabel={`${length} de ${BIO_MAX} caracteres`}
        color={full ? "danger" : length > 0 ? "default" : "muted"}
        style={styles.count}
        testID={`${testID}-counter`}
        variant="label"
      >
        {`${length}/${BIO_MAX}`}
      </Text>
    </View>
  );
}

/**
 * Ideas para empezar: plegadas tras «¿Sin ideas?», claramente opcionales.
 * Cada una se añade al final del texto (no sustituye nada).
 */
const BioIdeas = memo(function BioIdeas({ editable, onPick, testID }: { editable: boolean; onPick(starter: string): void; testID: string }) {
  const theme = useTheme();
  const c = theme.primitives.color;
  const [open, setOpen] = useState(false);

  return (
    <Stack gap="sm">
      <PressableScale
        accessibilityHint={open ? "Oculta las ideas" : "Muestra frases para empezar. Son opcionales."}
        accessibilityLabel="¿Sin ideas?"
        accessibilityState={{ expanded: open }}
        elevation="none"
        faceStyle={styles.toggleFace}
        hitSlop={8}
        onPress={() => setOpen((current) => !current)}
        style={styles.toggle}
        testID={`${testID}-ideas-toggle`}
      >
        <Text style={styles.toggleLabel} variant="label">
          ¿Sin ideas?
        </Text>
        <Icon color={c.ink} name={open ? "chevron-up" : "chevron-down"} size={18} />
      </PressableScale>

      {open ? (
        <Stack gap="sm" testID={`${testID}-ideas`}>
          <Text color="muted" variant="caption">
            Opcional. Toca una para añadirla al final de tu texto.
          </Text>
          <Inline gap="sm">
            {BIO_STARTERS.map((starter, index) => (
              <PressableScale
                accessibilityHint="Añade esta frase al final de tu descripción"
                accessibilityLabel={starter}
                disabled={!editable}
                elevation="xs"
                faceStyle={[
                  styles.chip,
                  {
                    backgroundColor: c.white,
                    borderColor: c.ink,
                    borderRadius: theme.primitives.radius.pill,
                    borderWidth: theme.primitives.border.thin
                  }
                ]}
                hitSlop={6}
                key={starter}
                onPress={() => onPick(starter)}
                testID={`${testID}-starter-${index}`}
              >
                <Icon color={c.inkSoft} name="plus" size={14} />
                <Text variant="callout">{starter}</Text>
              </PressableScale>
            ))}
          </Inline>
        </Stack>
      ) : null}
    </Stack>
  );
});

const styles = StyleSheet.create({
  input: {
    fontSize: 18,
    lineHeight: 26
  },
  meter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 4
  },
  minimum: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  count: {
    fontVariant: ["tabular-nums"]
  },
  toggle: {
    alignSelf: "flex-start"
  },
  toggleFace: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32
  },
  toggleLabel: {
    textDecorationLine: "underline"
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12
  }
});
