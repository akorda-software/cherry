import { useMemo } from "react";
import { useRouter, type Href } from "expo-router";

import { nextStepKey, previousStepKey, stepRoute, type OnboardingStepKey } from "../domain/steps";

/** Destino al terminar el onboarding. */
export const ONBOARDING_EXIT_ROUTE = "/(app)/(tabs)/discover";

type RouterLike = ReturnType<typeof useRouter> & {
  canGoBack?: () => boolean;
  dismissTo?: (href: Href) => void;
};

/**
 * Navegación entre pasos sobre la pila nativa del grupo `(onboarding)`: avanzar
 * es `push` (así el gesto/botón atrás del sistema funciona), volver es `back`
 * y saltar a un paso concreto usa `dismissTo` (vuelve si está en la pila o lo
 * sustituye si no).
 */
export function useOnboardingNavigation() {
  const router = useRouter() as RouterLike;

  return useMemo(
    () => ({
      goNext(from: OnboardingStepKey) {
        const next = nextStepKey(from);

        if (next) {
          router.push(stepRoute(next) as Href);
        }
      },

      goBack(from: OnboardingStepKey) {
        if (router.canGoBack?.()) {
          router.back();
          return;
        }

        const previous = previousStepKey(from);

        if (previous) {
          router.replace(stepRoute(previous) as Href);
        }
      },

      goTo(step: OnboardingStepKey) {
        const href = stepRoute(step) as Href;

        if (router.dismissTo) {
          router.dismissTo(href);
        } else {
          router.replace(href);
        }
      },

      exit() {
        router.replace(ONBOARDING_EXIT_ROUTE as Href);
      }
    }),
    [router]
  );
}
