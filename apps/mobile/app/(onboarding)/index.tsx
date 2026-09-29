import { useEffect, useRef } from "react";
import { useNavigation } from "expo-router";

import { useAppBootstrap } from "../../src/features/app-bootstrap";
import {
  loadProfileDraft,
  loadTagCatalog,
  type OnboardingStepKey,
  resolveResumeStep,
  stepsBefore,
  useAccountIdentity,
  useProfileCallApi
} from "../../src/features/onboarding";
import { LoadingScreen } from "../../src/shared/ui";

/**
 * Reanudar: calcula el primer paso sin contestar a partir de `GET /api/me/profile`
 * (fallback: `nextOnboardingStep` del bootstrap) y monta la pila con los pasos
 * anteriores debajo, para que «atrás» funcione desde el primer momento.
 */
export default function OnboardingIndexRoute() {
  const navigation = useNavigation();
  const callApi = useProfileCallApi();
  const { state } = useAppBootstrap();
  const { userId } = useAccountIdentity();
  const started = useRef(false);
  const hint = state.status === "ready" ? state.bootstrap.profile.nextOnboardingStep : null;

  useEffect(() => {
    if (!userId || started.current) {
      return;
    }

    started.current = true;
    // El catálogo de etiquetas se precarga en paralelo: el paso 7 aparece ya lleno.
    void loadTagCatalog(callApi).catch(() => undefined);

    void (async () => {
      let target: OnboardingStepKey;

      try {
        const profile = await loadProfileDraft(callApi, userId, { force: true });
        target = resolveResumeStep({ source: "profile", profile });
      } catch {
        target = resolveResumeStep({ source: "bootstrap", nextOnboardingStep: hint });
      }

      const routes = [...stepsBefore(target), target].map((name) => ({ name }));
      navigation.reset({ index: routes.length - 1, routes } as never);
    })();
  }, [callApi, hint, navigation, userId]);

  return <LoadingScreen message="Abriendo tu libreta..." testID="onboarding-resolving" />;
}
