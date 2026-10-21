import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, IconButton, Pill, Screen, Stack, Surface, Text, TopBar } from "../../../shared/ui";
import { useAppBootstrap } from "../../app-bootstrap";
import { PROVIDER_LIMIT_REACHED_BODY, VERIFICATION_METHODS, type VerificationMethodId } from "../domain/verification-copy";
import { NfcCountriesSheet } from "./nfc-countries-sheet";
import { verificationRoutes } from "./verification-routes";

const ROUTES: Partial<Record<VerificationMethodId, string>> = {
  nfc: verificationRoutes.document,
  selfie_provider: verificationRoutes.selfie
};

/**
 * Elegir cómo verificarse. El DNI por NFC es la vía recomendada (con la «i», los países cuyos
 * documentos acepta); el selfie solo si el servidor tiene proveedor y no se ha llegado al máximo del
 * mes, y la cartera europea llegará más adelante.
 */
export function VerificationMethodsScreen() {
  const router = useRouter();
  const { state } = useAppBootstrap();
  const ageVerification = state.status === "ready" ? state.bootstrap.ageVerification : undefined;
  const providerAvailable = ageVerification?.providerAvailable === true;
  const providerLimitReached = !providerAvailable && ageVerification?.providerLimitReached === true;
  const [countriesOpen, setCountriesOpen] = useState(false);

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
          const withInfo = method.id === "nfc";
          const limitReached = method.id === "selfie_provider" && providerLimitReached;

          return (
            <View key={method.id}>
              <Surface
                accessibilityHint={enabled ? undefined : limitReached ? "No disponible este mes" : "Todavía no está disponible"}
                accessibilityRole="button"
                accessibilityState={{ disabled: !enabled }}
                color={method.recommended ? "menta" : undefined}
                disabled={!enabled}
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
                    <View style={[styles.titleRow, withInfo ? styles.titleRowWithInfo : null]}>
                      <Text style={styles.flex} variant="bodyStrong">
                        {method.title}
                      </Text>
                    </View>
                    <Text color="muted" variant="callout">
                      {limitReached ? PROVIDER_LIMIT_REACHED_BODY : method.body}
                    </Text>
                    {method.recommended ? (
                      <Pill color="limonada" icon="star" label="Recomendado" size="sm" style={styles.pill} />
                    ) : null}
                    {!available ? (
                      <Pill label={limitReached ? "No disponible este mes" : "Próximamente"} size="sm" style={styles.pill} />
                    ) : null}
                  </Stack>
                  {enabled ? <Icon name="chevron-right" size={20} /> : null}
                </View>
              </Surface>
              {/* Fuera de la tarjeta, que es pulsable: tocar la «i» no abre la lectura del DNI. */}
              {withInfo ? (
                <IconButton
                  accessibilityLabel="Ver los países con NFC"
                  color="white"
                  flat
                  icon="info"
                  onPress={() => setCountriesOpen(true)}
                  size="sm"
                  style={styles.info}
                  testID="verify-nfc-countries"
                />
              ) : null}
            </View>
          );
        })}
      </Stack>
      <NfcCountriesSheet onClose={() => setCountriesOpen(false)} visible={countriesOpen} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 14, alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleRowWithInfo: { paddingRight: 36 },
  info: { position: "absolute", top: 8, right: 8 },
  flex: { flex: 1 },
  pill: { alignSelf: "flex-start", marginTop: 4 },
  unavailable: { opacity: 0.6 }
});
