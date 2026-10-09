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
import { readAppInfo } from "../infrastructure/app-info";

const howItWorks: readonly string[] = [
  "Las etiquetas mandan: nunca verás a alguien con una etiqueta que bloqueas, ni esa persona a ti.",
  "Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta.",
  "Guardamos tus mensajes cifrados en el servidor.",
  "Pausar, bloquear, reportar o borrar tu cuenta siempre está a mano."
];

/**
 * Acerca de: qué hace Snack con tus datos, la licencia y los créditos. Información, no
 * eslóganes: nada de promesas comerciales (eso vive fuera de la app).
 */
export function AboutScreen() {
  const appInfo = useMemo(() => readAppInfo(), []);
  const { sourceUrl } = appInfo;

  return (
    <Screen
      header={<TopBar fallbackHref={appShellRoutes.settings} left="back" title="Acerca de Snack" />}
      scroll
      testID="about-screen"
    >
      <View style={styles.hero}>
        <Mascot animated mood="happy" size={116} />
        <Text align="center" aria-level={1} role="heading" variant="title1">
          Snack
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

      <Surface padding="lg" radius="lg" testID="about-license">
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            Licencia
          </Text>
          <Text>El código fuente de Snack se distribuye bajo licencia AGPL-3.0.</Text>
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
