import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { createSafetyApi } from "@snack/mobile-shared";

import {
  Button,
  FormMessage,
  Icon,
  ListRow,
  ListSection,
  Sheet,
  Stack,
  Text,
  TextField,
  toast,
  useTheme
} from "../../../shared/ui";
import { useAuthedApi } from "../../auth/presentation";
import type { SafetyActionDeps } from "../application/safety-actions";
import { useSafetyFlow } from "../application/use-safety-flow";
import { MAX_REPORT_DETAILS_LENGTH, REPORT_REASON_OPTIONS } from "../domain/report-reasons";

export interface SafetySheetProps {
  visible: boolean;
  profileId: string;
  displayName: string;
  onClose(): void;
  /** Tras bloquear (la hoja ya se ha cerrado): saca a la persona de tu pantalla. */
  onBlocked?(): void;
  /** Tras enviar un reporte (la hoja sigue abierta para ofrecer bloquear también). */
  onReported?(): void;
  /** Sustituye la API real (tests, escaparates). */
  deps?: SafetyActionDeps;
  testID?: string;
}

/** Deps de producción: la API autenticada de seguridad. */
export function useSafetyApiDeps(): SafetyActionDeps {
  const callSafety = useAuthedApi(createSafetyApi);

  return useMemo(
    () => ({
      block: (profileId) => callSafety((api) => api.block(profileId)),
      report: (profileId, request) => callSafety((api) => api.report(profileId, request))
    }),
    [callSafety]
  );
}

/**
 * Hoja de seguridad: reportar (motivo + detalles opcionales) y bloquear (con confirmación
 * clara). Tono serio y cuidadoso: aquí no hay bromas.
 */
export function SafetySheet({
  visible,
  profileId,
  displayName,
  onClose,
  onBlocked,
  onReported,
  deps: injectedDeps,
  testID = "safety-sheet"
}: SafetySheetProps) {
  const apiDeps = useSafetyApiDeps();
  const flow = useSafetyFlow({
    profileId,
    deps: injectedDeps ?? apiDeps,
    onReported,
    onBlocked: () => {
      toast.show({ message: `Has bloqueado a ${displayName}. No volveréis a veros.`, tone: "neutral", icon: "block" });
      onClose();
      onBlocked?.();
    }
  });
  const { reset } = flow;

  // Cada vez que se abre, empieza desde el menú.
  useEffect(() => {
    if (visible) {
      reset();
    }
  }, [reset, visible]);

  const close = () => {
    if (!flow.submitting) {
      onClose();
    }
  };

  const title =
    flow.step === "report"
      ? `Reportar a ${displayName}`
      : flow.step === "block"
        ? `¿Bloquear a ${displayName}?`
        : flow.step === "reported"
          ? "Gracias por contárnoslo"
          : "Seguridad";

  const footer =
    flow.step === "report" ? (
      <Stack gap="sm">
        <Button
          disabled={!flow.canSubmitReport}
          fullWidth
          icon="flag"
          loading={flow.submitting}
          onPress={() => void flow.submitReport()}
          size="lg"
          testID={`${testID}-send-report`}
          variant="ink"
        >
          Enviar reporte
        </Button>
        <Button disabled={flow.submitting} fullWidth onPress={flow.back} variant="ghost">
          Volver
        </Button>
      </Stack>
    ) : flow.step === "block" ? (
      <Stack gap="sm">
        <Button
          fullWidth
          icon="block"
          loading={flow.submitting}
          onPress={() => void flow.confirmBlock()}
          size="lg"
          testID={`${testID}-confirm-block`}
          variant="danger"
        >
          Sí, bloquear
        </Button>
        <Button disabled={flow.submitting} fullWidth onPress={flow.back} variant="ghost">
          Cancelar
        </Button>
      </Stack>
    ) : flow.step === "reported" ? (
      <Stack gap="sm">
        <Button
          fullWidth
          icon="block"
          loading={flow.submitting}
          onPress={() => void flow.confirmBlock()}
          size="lg"
          testID={`${testID}-block-too`}
          variant="danger"
        >
          {`Bloquear también a ${displayName}`}
        </Button>
        <Button disabled={flow.submitting} fullWidth onPress={onClose} variant="secondary">
          Listo
        </Button>
      </Stack>
    ) : undefined;

  return (
    <Sheet
      dismissible={!flow.submitting}
      footer={footer}
      onClose={close}
      snap={flow.step === "report" ? "tall" : "auto"}
      testID={testID}
      title={title}
      visible={visible}
    >
      {flow.step === "menu" ? (
        <Stack gap="md">
          <Text color="muted" variant="callout">
            {`Si algo de ${displayName} no está bien, puedes contárnoslo o dejar de verle. No le avisaremos.`}
          </Text>
          <ListSection>
            <ListRow
              description="Cuéntanos qué ha pasado. Lo revisamos con cuidado."
              icon="flag"
              iconColor="limonada"
              label={`Reportar a ${displayName}`}
              onPress={flow.startReport}
              testID={`${testID}-report`}
            />
            <ListRow
              danger
              description="No os volveréis a ver ni podréis escribiros."
              icon="block"
              iconColor="tomate"
              label={`Bloquear a ${displayName}`}
              onPress={flow.startBlock}
              testID={`${testID}-block`}
            />
          </ListSection>
        </Stack>
      ) : null}

      {flow.step === "report" ? (
        <Stack gap="md">
          <Text variant="bodyStrong">¿Qué ha pasado?</Text>
          <View accessibilityRole="radiogroup" style={styles.reasons}>
            {REPORT_REASON_OPTIONS.map((option) => (
              <ReasonRow
                key={option.value}
                hint={option.hint}
                label={option.label}
                onPress={() => flow.selectReason(option.value)}
                selected={flow.reason === option.value}
                testID={`${testID}-reason-${option.value}`}
              />
            ))}
          </View>
          <TextField
            hint="Opcional. Cualquier detalle nos ayuda a revisarlo mejor."
            label="Detalles"
            maxLength={MAX_REPORT_DETAILS_LENGTH}
            multiline
            onChangeText={flow.setDetails}
            placeholder="Qué pasó, cuándo, en qué parte del perfil o del chat…"
            testID={`${testID}-details`}
            value={flow.details}
          />
          {flow.error ? <FormMessage tone="error">{flow.error}</FormMessage> : null}
        </Stack>
      ) : null}

      {flow.step === "block" ? (
        <Stack gap="md">
          <BlockExplainer displayName={displayName} />
          {flow.error ? <FormMessage tone="error">{flow.error}</FormMessage> : null}
        </Stack>
      ) : null}

      {flow.step === "reported" ? (
        <Stack gap="md">
          <View style={styles.thanks}>
            <Icon name="shield-check" size={32} />
            <Text style={styles.flex} variant="callout">
              {`Revisaremos tu reporte con cuidado. ${displayName} no sabrá que has sido tú. Si prefieres no volver a verle, bloquéale también.`}
            </Text>
          </View>
          {flow.error ? <FormMessage tone="error">{flow.error}</FormMessage> : null}
        </Stack>
      ) : null}
    </Sheet>
  );
}

function BlockExplainer({ displayName }: { displayName: string }) {
  const points = [
    "No os volveréis a ver en Descubrir ni en Likes.",
    "Ninguno de los dos podrá escribir al otro; si teníais match, se deshace.",
    `${displayName} no recibirá ningún aviso.`
  ];

  return (
    <Stack gap="sm">
      {points.map((point) => (
        <View key={point} style={styles.point}>
          <Icon name="check" size={20} />
          <Text style={styles.flex} variant="callout">
            {point}
          </Text>
        </View>
      ))}
    </Stack>
  );
}

function ReasonRow({
  label,
  hint,
  selected,
  onPress,
  testID
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress(): void;
  testID?: string;
}) {
  const theme = useTheme();
  const c = theme.primitives.color;

  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.reason,
        {
          borderColor: selected ? c.ink : c.dot,
          borderWidth: selected ? theme.primitives.border.regular : theme.primitives.border.thin,
          backgroundColor: selected ? theme.primitives.pastel.limonada.soft : c.white,
          borderRadius: theme.primitives.radius.md
        },
        pressed ? styles.pressed : null
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.radio,
          {
            borderColor: c.ink,
            borderWidth: theme.primitives.border.regular,
            backgroundColor: selected ? c.ink : c.white
          }
        ]}
      >
        {selected ? <Icon color={c.white} name="check" size={14} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant="label">{label}</Text>
        <Text color="muted" variant="caption">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  reasons: {
    gap: 8
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 56
  },
  pressed: {
    opacity: 0.85
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  thanks: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  point: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  }
});
