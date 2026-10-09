import { Redirect, type Href } from "expo-router";

import { stepRoute } from "../../src/features/onboarding";

/**
 * Ruta antigua: bloquear etiquetas ya se hace en la misma página que elegirlas
 * («+» / «−»). Se mantiene solo para que un historial o enlace viejo no se rompa.
 */
export default function OnboardingBlockedTagsLegacyRoute() {
  return <Redirect href={stepRoute("tags") as Href} />;
}
