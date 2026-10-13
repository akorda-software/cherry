import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Button, Icon, Screen, Stack, Surface, Text, TopBar } from "../../../shared/ui";
import { WHY_REASONS } from "../domain/verification-copy";
import { verificationRoutes } from "./verification-routes";

/**
 * Primera pantalla de «Comprobar tu edad»: por qué se pide, antes de elegir cómo. La fricción
 * es grande (escanear un documento), así que se explica con calma y sin promesas.
 */
export function VerificationIntroScreen() {
  const router = useRouter();

  return (
    <Screen
      footer={
        <Button fullWidth onPress={() => router.push(verificationRoutes.methods)} size="lg" testID="verify-intro-next">
          Elegir cómo hacerlo
        </Button>
      }
      header={<TopBar left="close" testID="verify-intro-top-bar" title="Comprobar tu edad" />}
      scroll
      testID="verification-intro-screen"
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Text accessibilityRole="header" variant="title1">
            Antes de empezar, comprueba tu edad
          </Text>
          <Text color="muted">
            Tu perfil está guardado, pero no se activa hasta que lo hagas. Mientras tanto puedes editarlo como quieras.
          </Text>
        </Stack>

        {WHY_REASONS.map((reason) => (
          <View key={reason.title} style={styles.row}>
            <Surface border="thin" color="cielo" elevation="sm" padding="sm" radius="pill" soft>
              <Icon name={reason.icon} size={20} />
            </Surface>
            <Stack flex gap="xs">
              <Text variant="bodyStrong">{reason.title}</Text>
              <Text color="muted" variant="callout">
                {reason.body}
              </Text>
            </Stack>
          </View>
        ))}

        <Surface color="melocoton" padding="md" radius="lg" soft testID="verify-intro-minors">
          <View style={styles.row}>
            <Icon name="info" size={20} />
            <Text style={styles.flex} variant="callout">
              Si el documento dice que tienes menos de 18 años, se borran la cuenta y todo lo que hayas subido.
            </Text>
          </View>
        </Surface>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  flex: { flex: 1 }
});
