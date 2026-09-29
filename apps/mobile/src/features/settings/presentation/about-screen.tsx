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
  Stamp,
  StickyNote,
  Surface,
  Text,
  TopBar,
  useTheme
} from "../../../shared/ui";
import { readAppInfo } from "../infrastructure/app-info";

const weDont: readonly string[] = [
  "No vendemos tus datos ni tu atención.",
  "Sin anuncios, suscripciones, boosts ni super likes.",
  "Sin muros de pago ni límites diarios de likes.",
  "Sin trucos para retenerte: ni cuentas atrás ni escasez inventada."
];

const weDo: readonly string[] = [
  "Las etiquetas mandan: nunca verás a alguien con una etiqueta que bloqueas, ni esa persona a ti.",
  "Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta.",
  "Guardamos tus mensajes cifrados en el servidor.",
  "Pausar, bloquear, reportar o borrar tu cuenta siempre está a mano."
];

/**
 * El manifiesto de Snack como página de libreta: por qué es gratis, qué no hacemos, qué sí,
 * el código abierto y los créditos. Nada de cifras ni promesas que no estén en el producto.
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
        <View style={styles.heroArt}>
          <Mascot animated mood="love" size={116} />
          <Stamp label="Gratis" rotation={-12} size="md" slam style={styles.stamp} testID="about-stamp" tone="fresa" />
        </View>
        <Text align="center" aria-level={1} role="heading" variant="title1">
          {"Una app de citas\nde tu parte."}
        </Text>
        <Text align="center" color="muted">
          Snack es gratis, de código abierto y está hecha para que conozcas gente a gusto, no para tenerte enganchado.
        </Text>
      </View>

      <StickyNote color="limonada" tape={{ color: "cielo", pattern: "dots" }} testID="about-free" tilt={-1.5}>
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            ¿Por qué es gratis?
          </Text>
          <Text>
            Snack existe para demostrar que una app de citas puede servir a las personas en vez de exprimirlas. Todo lo
            que otras apps cobran (ver quién te ha dado like, los filtros, deshacer un «no») aquí es gratis. Para
            siempre.
          </Text>
        </View>
      </StickyNote>

      <Surface padding="lg" radius="lg" rotate={0.8} testID="about-dont">
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            Lo que no hacemos
          </Text>
          {weDont.map((item) => (
            <Point color="tomate" icon="x" key={item}>
              {item}
            </Point>
          ))}
        </View>
      </Surface>

      <StickyNote color="menta" tape={{ color: "fresa", pattern: "hearts" }} testID="about-do" tilt={1.2}>
        <View style={styles.noteBody}>
          <Text role="heading" variant="title3">
            Lo que sí hacemos
          </Text>
          {weDo.map((item) => (
            <Point color="white" icon="check" key={item}>
              {item}
            </Point>
          ))}
        </View>
      </StickyNote>

      <Surface color="cielo" padding="lg" radius="lg" soft testID="about-open-source">
        <View style={styles.noteBody}>
          <View style={styles.titleRow}>
            <Icon name="code" size={24} />
            <Text role="heading" variant="title3">
              Código abierto
            </Text>
          </View>
          <Text>
            El código de Snack es abierto: cualquiera puede leerlo, auditarlo o montar su propia instancia en su
            servidor.
          </Text>
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
          Tipografías: Mochiy Pop One, M PLUS Rounded 1c y Yomogi, con licencia SIL Open Font License.
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
    gap: 10,
    paddingTop: 4
  },
  heroArt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2
  },
  stamp: {
    alignSelf: "center",
    marginTop: 36
  },
  noteBody: {
    gap: 10
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
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
