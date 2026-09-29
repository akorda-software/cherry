import { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { friendlyErrorMessage } from "../../../../shared/api";
import { ErrorState, haptics, HeartBurst, Mascot, toast } from "../../../../shared/ui";
import { refreshBootstrap } from "../../../app-bootstrap";
import { useProfileDraftStore } from "../../application/profile-draft-store";
import { completeOnboarding } from "../../application/step-actions";
import { useStepCta } from "../../application/step-cta-store";
import { StepPage } from "../step-page";
import { useOnboardingNavigation } from "../use-onboarding-navigation";
import { useProfileDraft } from "../use-profile-draft";

type Phase = "working" | "done" | "error";

/**
 * Paso final: confirma el perfil (`POST /api/me/profile/complete`) y lo
 * celebra con Mochi y un estallido de corazones. Si backend echa algo en
 * falta, vuelve al primer paso que falte.
 */
export function DoneStep() {
  const { callApi } = useProfileDraft();
  const navigation = useOnboardingNavigation();
  const [phase, setPhase] = useState<Phase>("working");
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const running = useRef(false);
  const phaseRef = useRef<Phase>("working");
  phaseRef.current = phase;

  const complete = useCallback(async () => {
    if (running.current) {
      return;
    }

    running.current = true;
    setPhase("working");
    setError(null);

    try {
      const result = await callApi((api) => completeOnboarding(api));

      if (result.status === "completed") {
        useProfileDraftStore.getState().setProfile(result.profile);
        setPhase("done");
        haptics.success();
        return;
      }

      toast.show({ message: "Nos falta un detallito. ¡Es un momento!", tone: "info", icon: "pencil" });
      navigation.goTo(result.step);
    } catch (caught) {
      setError(friendlyErrorMessage(caught, "No hemos podido terminar tu perfil. Inténtalo otra vez."));
      setPhase("error");
    } finally {
      running.current = false;
    }
  }, [callApi, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (phaseRef.current !== "done") {
        void complete();
      }
    }, [complete])
  );

  const start = async () => {
    setLeaving(true);

    try {
      // El guard de la zona privada mira el bootstrap: primero se refresca.
      await refreshBootstrap();
    } finally {
      navigation.exit();
    }
  };

  useStepCta("done", {
    enabled: phase !== "working" && !leaving,
    busy: phase === "working" || leaving,
    label: phase === "error" ? "Reintentar" : "¡A descubrir!",
    testID: "onboarding-cta-done",
    onPress: () => {
      if (phase === "error") {
        void complete();
      } else {
        void start();
      }
    }
  });

  if (phase === "error") {
    return (
      <StepPage centered step="done" testID="onboarding-step-done" title="Casi, casi...">
        <ErrorState compact message={error ?? ""} mood="sad" testID="onboarding-done-error" />
      </StepPage>
    );
  }

  const done = phase === "done";

  return (
    <StepPage
      centered
      // Nueva página al terminar: el título y Mochi vuelven a entrar con la celebración.
      key={phase}
      hero={
        <View style={styles.hero}>
          <Mascot animated color="fresa" mood={done ? "celebrate" : "thinking"} size={168} />
          {done ? <HeartBurst autoPlay count={24} power={1.15} style={StyleSheet.absoluteFill} testID="onboarding-done-burst" /> : null}
        </View>
      }
      step="done"
      subtitle={
        done
          ? "Ya puedes descubrir gente con tus etiquetas en común. Gratis, sin trucos y a tu ritmo."
          : "Pegando las últimas pegatinas..."
      }
      testID="onboarding-step-done"
      title={done ? "¡Tu perfil está listo!" : "Un segundito..."}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    width: 240,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8
  }
});
