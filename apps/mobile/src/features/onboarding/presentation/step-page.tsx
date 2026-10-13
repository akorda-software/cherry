import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

import { Appear, ErrorState, PaperBackground, Stack, Text, useTheme } from "../../../shared/ui";
import type { OnboardingStepKey } from "../domain/steps";
import { useOnboardingFrame } from "./onboarding-frame";
import { stepAccent } from "./step-tones";
import { useProfileDraft } from "./use-profile-draft";

export interface StepPageProps {
  step: OnboardingStepKey;
  title: string;
  /** Ilustración encima del título (celebraciones). */
  hero?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** Algo fijo sobre el contenido desplazable. */
  pinned?: ReactNode;
  /** Franja que se queda pegada arriba al desplazar (p. ej. el estante de etiquetas). Ocupa todo el ancho. */
  sticky?: ReactNode;
  /** Contenido desplazable (por defecto sí). */
  scroll?: boolean;
  /** Centra verticalmente (pantallas de celebración). */
  centered?: boolean;
  testID?: string;
}

/**
 * Página de un paso: papel blanco roto (sin teñir) y el título como pregunta única,
 * con la última palabra subrayada con el rotulador del paso (cada paso tiene su
 * color de acento), y el contenido entre la cabecera y el pie
 * flotantes del marco. Entrada: el papel se asienta (funde y sube un poco);
 * con «reducir movimiento», solo funde.
 */
export function StepPage({
  step,
  title,
  subtitle,
  hero,
  children,
  pinned,
  sticky,
  scroll = true,
  centered = false,
  testID
}: StepPageProps) {
  const theme = useTheme();
  const { headerHeight, footerHeight } = useOnboardingFrame();
  const draft = useProfileDraft();
  const side = theme.semantic.layout.screenPadding;
  const spacing = theme.primitives.spacing;

  const heading = (
    <Appear distance={10}>
      <Stack align={centered ? "center" : undefined} gap="xs">
        {hero ?? null}
        <Text accessibilityRole="header" align={centered ? "center" : undefined} variant="title1">
          <MarkedTitle color={theme.primitives.pastel[stepAccent(step)].fill} title={title} />
        </Text>
        {typeof subtitle === "string" ? (
          <Text align={centered ? "center" : undefined} color="muted">
            {subtitle}
          </Text>
        ) : (
          subtitle ?? null
        )}
      </Stack>
    </Appear>
  );

  const content = draft.failed ? (
    <ErrorState
      compact
      message="No hemos podido cargar tu perfil. Revisa tu conexión y vuelve a probar."
      onRetry={draft.retry}
      testID={`${testID ?? step}-draft-error`}
    />
  ) : (
    <Appear delay={70} distance={14}>
      {children}
    </Appear>
  );

  const stickyBand = sticky ? <View style={{ marginHorizontal: -side }}>{sticky}</View> : null;

  const contentStyle = {
    paddingHorizontal: side,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    maxWidth: theme.semantic.layout.contentMaxWidth,
    width: "100%" as const,
    alignSelf: "center" as const
  };

  return (
    <View style={[styles.page, { backgroundColor: theme.semantic.color.screenBackground }]} testID={testID}>
      <PaperBackground animateTone={false} />
      <View style={[styles.body, { marginTop: headerHeight, marginBottom: footerHeight }]}>
        {pinned}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[contentStyle, centered ? styles.centered : null]}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            stickyHeaderIndices={stickyBand ? [1] : undefined}
            style={styles.flex}
          >
            {heading}
            {stickyBand}
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, contentStyle, centered ? styles.centered : null]}>
            {heading}
            {stickyBand}
            {content}
          </View>
        )}
      </View>
    </View>
  );
}

/** Separa la última palabra del título (sin la puntuación final) para marcarla. */
export function splitMarkedTitle(title: string): [string, string, string] {
  const match = /^(.*?)([^\s¿¡]+?)([?!.…]*)$/su.exec(title.trim());
  return match ? [match[1], match[2], match[3]] : ["", title, ""];
}

/** Rotulador: fondo de color tras la última palabra, como un subrayado grueso. */
function MarkedTitle({ title, color }: { title: string; color: string }) {
  const [before, word, after] = splitMarkedTitle(title);
  return (
    <>
      {before}
      <Text style={{ backgroundColor: color }} variant="title1">
        {word}
      </Text>
      {after}
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1
  },
  body: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  centered: {
    flexGrow: 1,
    justifyContent: "center"
  }
});
