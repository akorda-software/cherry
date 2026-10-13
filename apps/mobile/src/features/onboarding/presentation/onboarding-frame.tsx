import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Keyboard, type LayoutChangeEvent, Platform, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, IconButton, ProgressBar, Text, useTheme } from "../../../shared/ui";
import { useStepCtaStore } from "../application/step-cta-store";
import { ONBOARDING_STEP_KEYS, stepFromPathname, stepIndex, stepProgress } from "../domain/steps";
import { stepAccent } from "./step-tones";
import { useOnboardingNavigation } from "./use-onboarding-navigation";

interface FrameMetrics {
  /** Alto de la cabecera flotante (safe area incluida): el contenido empieza debajo. */
  headerHeight: number;
  /** Alto del pie flotante (safe area incluida): el contenido acaba encima. */
  footerHeight: number;
}

const FrameContext = createContext<FrameMetrics>({ headerHeight: 0, footerHeight: 0 });

export function useOnboardingFrame(): FrameMetrics {
  return useContext(FrameContext);
}

const BUTTON_HEIGHT = 60;
const HINT_HEIGHT = 20;

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

/**
 * Marco común del onboarding: cabecera con «atrás» y la barra de progreso
 * gorda, y la llamada a la acción fija abajo (la declara cada paso con
 * `useStepCta`). Flota por encima de la pila nativa: las páginas, cada una con
 * su papel pastel, pasan por debajo al avanzar o volver (con gesto incluido).
 * El teclado empuja el pie hacia arriba y encoge las páginas: nunca lo tapa.
 */
export function OnboardingFrame({ children }: PropsWithChildren) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const step = stepFromPathname(pathname);
  const cta = useStepCtaStore((state) => (step ? state.byStep[step] : undefined));
  const navigation = useOnboardingNavigation();
  const keyboardVisible = useKeyboardVisible();
  const spacing = theme.primitives.spacing;

  const footerPaddingBottom = (keyboardVisible ? 0 : insets.bottom) + spacing.sm + 4;
  const estimatedHeader = insets.top + spacing.sm + 48 + spacing.sm;
  const estimatedFooter = spacing.sm + HINT_HEIGHT + spacing.xs + BUTTON_HEIGHT + footerPaddingBottom;
  const [measured, setMeasured] = useState<{ header: number | null; footer: number | null }>({
    header: null,
    footer: null
  });

  const metrics = useMemo<FrameMetrics>(
    () => ({
      headerHeight: measured.header ?? estimatedHeader,
      footerHeight: measured.footer ?? estimatedFooter
    }),
    [estimatedFooter, estimatedHeader, measured.footer, measured.header]
  );

  const onHeaderLayout = (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setMeasured((current) => (current.header === height ? current : { ...current, header: height }));
  };

  const onFooterLayout = (event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setMeasured((current) => (current.footer === height ? current : { ...current, footer: height }));
  };

  const showBack = step !== null && step !== "name" && step !== "done";
  const index = step ? stepIndex(step) : 0;

  return (
    <FrameContext.Provider value={metrics}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.flex}>
          {children}

          <View
            onLayout={onHeaderLayout}
            pointerEvents="box-none"
            style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, gap: spacing.md }]}
          >
            {showBack ? (
              <IconButton
                accessibilityLabel="Volver al paso anterior"
                icon="arrow-left"
                onPress={() => step && navigation.goBack(step)}
                size="md"
                testID="onboarding-back"
              />
            ) : (
              <View style={styles.backSpacer} />
            )}
            <ProgressBar
              accessibilityLabel={step ? `Paso ${index + 1} de ${ONBOARDING_STEP_KEYS.length}` : "Tu perfil"}
              color={step ? stepAccent(step) : "fresa"}
              size="lg"
              style={styles.progress}
              testID="onboarding-progress"
              value={step ? stepProgress(step) : 0}
            />
          </View>

          {cta && !cta.hidden ? (
            <View
              onLayout={onFooterLayout}
              pointerEvents="box-none"
              style={[
                styles.footer,
                { paddingHorizontal: spacing.lg, paddingBottom: footerPaddingBottom, paddingTop: spacing.sm, gap: spacing.xs }
              ]}
            >
              <View style={styles.hint}>
                {cta.hint ? (
                  <Text align="center" color="muted" numberOfLines={1} testID="onboarding-cta-hint" variant="caption">
                    {cta.hint}
                  </Text>
                ) : null}
              </View>
              <Button
                disabled={!cta.enabled}
                fullWidth
                loading={cta.busy}
                onPress={cta.onPress}
                size="lg"
                testID={cta.testID}
              >
                {cta.label}
              </Button>
              {cta.secondary ? (
                <Button onPress={cta.secondary.onPress} size="md" testID={cta.secondary.testID} variant="ghost">
                  {cta.secondary.label}
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </FrameContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 8
  },
  backSpacer: {
    width: 48,
    height: 48
  },
  progress: {
    flex: 1
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0
  },
  hint: {
    minHeight: HINT_HEIGHT,
    justifyContent: "center"
  }
});
