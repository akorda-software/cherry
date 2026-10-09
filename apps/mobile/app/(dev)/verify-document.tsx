import { Redirect } from "expo-router";

import { DocumentVerificationScreen } from "../../src/features/verification";

/**
 * Prueba de la verificación de edad por NFC (D-2026-10-09). Solo en desarrollo: todavía no
 * forma parte del onboarding. Guía: docs/compliance/02-nfc-pruebas-manana.md.
 */
export default function VerifyDocumentRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <DocumentVerificationScreen />;
}
