import { type ReactNode, useMemo } from "react";
import { Linking, StyleSheet, View } from "react-native";

import {
  appShellRoutes,
  Button,
  Icon,
  type IconName,
  Mascot,
  type PastelName,
  Screen,
  StickyNote,
  Surface,
  Text,
  TopBar,
  useTheme
} from "../../../shared/ui";
import { useInstanceInfo } from "../../../shared/config";
import { normalizeContactEmail, normalizeSourceUrl } from "../domain/app-info";
import { readAppInfo } from "../infrastructure/app-info";

const howItWorks: readonly string[] = [
  "Las etiquetas mandan: nunca verás a alguien con una etiqueta que bloqueas, ni esa persona a ti.",
  "Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta.",
  "Guardamos tus mensajes cifrados en el servidor.",
  "Pausar, bloquear, reportar o borrar tu cuenta siempre está a mano."
];

/**
 * Acerca de: qué hace Cherry con tus datos, quién gestiona la instancia (de `GET /api/config`), la
 * licencia y los créditos. Información, no eslóganes: nada de promesas comerciales (eso vive fuera
 * de la app).
 */
export function AboutScreen() {
  const appInfo = useMemo(() => readAppInfo(), []);
  const instance = useInstanceInfo();
  // El código de esta compilación primero; si no, el que declara el servidor.
  const sourceUrl = appInfo.sourceUrl ?? normalizeSourceUrl(instance?.sourceUrl);
  const operator = instance?.operator?.trim() || null;
  const contactEmail = normalizeContactEmail(instance?.contactEmail);
  const privacyUrl = normalizeSourceUrl(instance?.privacyUrl);
  const termsUrl = normalizeSourceUrl(instance?.termsUrl);
  const instanceName = instance?.name?.trim() || "Cherry";

  return (
    <Screen
      header={<TopBar fallbackHref={appShellRoutes.settings} left="back" title="Acerca de Cherry" />}
      scroll
      testID="about-screen"
    >
      <View style={styles.hero}>
        <Mascot animated mood="happy" size={116} />
        <Text align="center" aria-level={1} role="heading" variant="title1">
          {instanceName}
        </Text>
      </View>

      <StickyNote color="menta" tape={{ color: "fresa", pattern: "dots" }} testID="about-how" tilt={1.2}>
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            Cómo funciona
          </Text>
          {howItWorks.map((item) => (
            <Point color="white" icon="check" key={item}>
              {item}
            </Point>
          ))}
        </View>
      </StickyNote>

      {operator || contactEmail || privacyUrl || termsUrl ? (
        <Surface padding="lg" radius="lg" testID="about-instance">
          <View style={styles.noteBody}>
            <Text role="heading" variant="title3">
              Quién gestiona esta instancia
            </Text>
            {operator ? <Text>{`Esta instancia la gestiona ${operator}, de forma independiente.`}</Text> : null}
            {contactEmail ? (
              <Button
                accessibilityHint="Abre tu app de correo"
                icon="mail"
                onPress={() => void Linking.openURL(`mailto:${contactEmail}`)}
                size="md"
                style={styles.sourceButton}
                testID="about-contact"
                variant="secondary"
              >
                {`Escribir a ${contactEmail}`}
              </Button>
            ) : null}
            {privacyUrl ? (
              <Button
                accessibilityHint="Abre la política de privacidad en el navegador"
                iconRight="external"
                onPress={() => void Linking.openURL(privacyUrl)}
                size="md"
                style={styles.sourceButton}
                testID="about-privacy"
                variant="secondary"
              >
                Política de privacidad
              </Button>
            ) : null}
            {termsUrl ? (
              <Button
                accessibilityHint="Abre las condiciones de uso en el navegador"
                iconRight="external"
                onPress={() => void Linking.openURL(termsUrl)}
                size="md"
                style={styles.sourceButton}
                testID="about-terms"
                variant="secondary"
              >
                Condiciones de uso
              </Button>
            ) : null}
          </View>
        </Surface>
      ) : null}

      <Surface padding="lg" radius="lg" testID="about-license">
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            Licencia
          </Text>
          <Text>El código fuente de Cherry se distribuye bajo licencia AGPL-3.0.</Text>
          {sourceUrl ? (
            <Button
              accessibilityHint="Abre el repositorio en el navegador"
              icon="code"
              iconRight="external"
              onPress={() => void Linking.openURL(sourceUrl)}
              size="md"
              style={styles.sourceButton}
              testID="about-source"
              variant="secondary"
            >
              Ver el código
            </Button>
          ) : null}
        </View>
      </Surface>

      <View style={styles.credits}>
        <Text align="center" color="muted" variant="caption">
          Tipografía: Rubik, con licencia SIL Open Font License.
        </Text>
        {appInfo.version ? (
          <Text align="center" color="faint" variant="caption">
            {`Versión ${appInfo.version}`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

function Point({ icon, color, children }: { icon: IconName; color: PastelName | "white"; children: ReactNode }) {
  const theme = useTheme();
  const fill = color === "white" ? theme.primitives.color.white : theme.primitives.pastel[color].fill;

  return (
    <View style={styles.point}>
      <View
        style={[
          styles.pointIcon,
          {
            backgroundColor: fill,
            borderColor: theme.primitives.color.ink,
            borderWidth: theme.primitives.border.thin
          }
        ]}
      >
        <Icon name={icon} size={14} strokeWidth={3} />
      </View>
      <Text style={styles.pointText} variant="callout">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: 6,
    paddingTop: 4
  },
  noteBody: {
    gap: 10
  },
  point: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  pointIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  pointText: {
    flex: 1
  },
  sourceButton: {
    alignSelf: "flex-start"
  },
  credits: {
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 8
  }
});
