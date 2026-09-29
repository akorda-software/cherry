import { StyleSheet, View } from "react-native";

import { Mascot, type MascotMood } from "../art";
import { Button } from "../primitives/button";
import { Text } from "../primitives/text";
import { Sheet } from "./sheet";

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Acción destructiva (botón tomate). */
  destructive?: boolean;
  /** Confirmación en curso: puntitos en el botón y no se puede cerrar. */
  loading?: boolean;
  /** Mochi encima del título (`null` = sin Mochi). */
  mood?: MascotMood | null;
  onConfirm(): void;
  onCancel(): void;
  testID?: string;
}

/** Confirmación en hoja inferior: título, explicación, confirmar y cancelar. */
export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  mood,
  onConfirm,
  onCancel,
  testID
}: ConfirmSheetProps) {
  const face = mood === undefined ? (destructive ? "surprised" : "thinking") : mood;

  return (
    <Sheet
      dismissible={!loading}
      footer={
        <>
          <Button
            fullWidth
            loading={loading}
            onPress={onConfirm}
            size="lg"
            testID={testID ? `${testID}-confirm` : undefined}
            variant={destructive ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
          <Button
            disabled={loading}
            fullWidth
            onPress={onCancel}
            testID={testID ? `${testID}-cancel` : undefined}
            variant="ghost"
          >
            {cancelLabel}
          </Button>
        </>
      }
      onClose={onCancel}
      scroll={false}
      showClose={false}
      testID={testID}
      visible={visible}
    >
      <View style={styles.body}>
        {face ? <Mascot animated={false} color={destructive ? "tomate" : "fresa"} mood={face} size={88} /> : null}
        <Text align="center" role="heading" variant="title2">
          {title}
        </Text>
        {message ? (
          <Text align="center" color="muted">
            {message}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 8
  }
});
