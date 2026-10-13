import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Button, FormMessage, Icon, type IconName, Mascot, Sheet, Text, useTheme } from "../../../shared/ui";
import { deleteAccountConsequences } from "../domain/delete-account";
import { HoldToConfirmButton } from "./hold-to-confirm-button";

const consequenceIcons: readonly IconName[] = ["eye-off", "logout", "lock"];

interface DeleteAccountSheetProps {
  visible: boolean;
  /** Borrado en curso: la hoja no se puede cerrar. */
  pending: boolean;
  error: string | null;
  onConfirm(): void;
  onClose(): void;
}

/**
 * Borrar la cuenta en dos pasos dentro de la misma hoja: primero, qué pasa de verdad (sin
 * dramas ni trucos para retenerte); después, mantener pulsado para confirmar.
 */
export function DeleteAccountSheet({ visible, pending, error, onConfirm, onClose }: DeleteAccountSheetProps) {
  const theme = useTheme();
  const [step, setStep] = useState<"explain" | "confirm">("explain");

  useEffect(() => {
    if (visible) {
      setStep("explain");
    }
  }, [visible]);

  const footer =
    step === "explain" ? (
      <>
        <Button fullWidth onPress={() => setStep("confirm")} size="lg" testID="delete-continue" variant="danger">
          Quiero borrarla
        </Button>
        <Button fullWidth onPress={onClose} testID="delete-cancel" variant="ghost">
          Mejor no
        </Button>
      </>
    ) : (
      <>
        <HoldToConfirmButton
          accessibilityLabel="Borrar mi cuenta"
          holdingLabel="Sigue pulsando…"
          label="Mantén pulsado para borrar"
          loading={pending}
          onConfirm={onConfirm}
          testID="delete-hold"
        />
        <Button disabled={pending} fullWidth onPress={onClose} testID="delete-cancel" variant="ghost">
          Mejor no
        </Button>
      </>
    );

  return (
    <Sheet
      dismissible={!pending}
      footer={footer}
      onClose={onClose}
      showClose={false}
      testID="delete-sheet"
      visible={visible}
    >
      {step === "explain" ? (
        <View style={styles.body}>
          <Mascot color="tomate" mood="sad" size={84} />
          <Text align="center" role="heading" variant="title2">
            ¿Borrar tu cuenta?
          </Text>
          <Text align="center" color="muted">
            Esto es lo que pasa si la borras:
          </Text>
          <View style={styles.list}>
            {deleteAccountConsequences.map((text, index) => (
              <View key={text} style={styles.item}>
                <View
                  style={[
                    styles.itemIcon,
                    {
                      backgroundColor: theme.primitives.pastel.tomate.soft,
                      borderColor: theme.primitives.color.ink,
                      borderWidth: theme.primitives.border.thin
                    }
                  ]}
                >
                  <Icon name={consequenceIcons[index] ?? "info"} size={18} />
                </View>
                <Text style={styles.itemText} variant="callout">
                  {text}
                </Text>
              </View>
            ))}
          </View>
          <Text align="center" color="muted" variant="callout">
            ¿Solo necesitas un respiro? También puedes pausar tu perfil.
          </Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Mascot color="tomate" mood="surprised" size={84} />
          <Text align="center" role="heading" variant="title2">
            Última confirmación
          </Text>
          <Text align="center" color="muted">
            Mantén pulsado el botón hasta que se llene. Es definitivo: no se puede deshacer.
          </Text>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: "center",
    gap: 10,
    paddingBottom: 4
  },
  list: {
    alignSelf: "stretch",
    gap: 12,
    marginVertical: 6
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  itemText: {
    flex: 1
  }
});
