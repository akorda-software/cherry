import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, Pill, Screen, Stack, Surface, Text, TopBar } from "../../../shared/ui";
import { useAppBootstrap } from "../../app-bootstrap";
import { VERIFICATION_METHODS, type VerificationMethodId } from "../domain/verification-copy";
import { verificationRoutes } from "./verification-routes";

const ROUTES: Partial<Record<VerificationMethodId, string>> = {
  nfc: verificationRoutes.document,
  selfie_provider: verificationRoutes.selfie
};

/**
 * Elegir cómo verificarse. El DNI por NFC es la vía recomendada; el selfie solo si el servidor tiene
 * proveedor y la cartera europea llegará más adelante.
 */
export function VerificationMethodsScreen() {
  const router = useRouter();
  const { state } = useAppBootstrap();
  const providerAvailable = state.status === "ready" && state.bootstrap.ageVerification?.providerAvailable === true;

  return (
    <Screen
      header={<TopBar left="back" testID="verify-methods-top-bar" title="Comprobar tu edad" />}
      scroll
      testID="verification-methods-screen"
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Text accessibilityRole="header" variant="title1">
            ¿Cómo quieres hacerlo?
          </Text>
          <Text color="muted">Con cualquiera de ellas solo guardamos que eres mayor de edad.</Text>
        </Stack>

        {VERIFICATION_METHODS.map((method) => {
          const route = ROUTES[method.id];
          const available = method.available && (method.id !== "selfie_provider" || providerAvailable);
          const enabled = available && route !== undefined;

          return (
            <Surface
              accessibilityHint={enabled ? undefined : "Todavía no está disponible"}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              color={method.recommended ? "menta" : undefined}
              disabled={!enabled}
              key={method.id}
              onPress={enabled ? () => router.push(route) : undefined}
              padding="md"
              radius="lg"
              soft={method.recommended}
              style={!enabled ? styles.unavailable : undefined}
              testID={`verify-method-${method.id}`}
            >
              <View style={styles.row}>
                <Surface border="thin" color={method.recommended ? "menta" : "cielo"} elevation="sm" padding="sm" radius="pill">
                  <Icon name={method.icon} size={22} />
                </Surface>
                <Stack flex gap="xs">
                  <View style={styles.titleRow}>
                    <Text style={styles.flex} variant="bodyStrong">
                      {method.title}
                    </Text>
                  </View>
                  <Text color="muted" variant="callout">
                    {method.body}
                  </Text>
                  {method.recommended ? (
                    <Pill color="limonada" icon="star" label="Recomendado" size="sm" style={styles.pill} />
                  ) : null}
                  {!available ? <Pill label="Próximamente" size="sm" style={styles.pill} /> : null}
                </Stack>
                {enabled ? <Icon name="chevron-right" size={20} /> : null}
              </View>
            </Surface>
          );
        })}
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1 },
  pill: { alignSelf: "flex-start", marginTop: 4 },
  unavailable: { opacity: 0.6 }
});
