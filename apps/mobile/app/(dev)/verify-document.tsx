import { Redirect } from "expo-router";

import { DocumentVerificationScreen } from "../../src/features/verification";

/**
 * Acceso directo a la lectura NFC del documento (D-2026-10-09), solo en desarrollo. El flujo
 * real empieza en `/verify`. Guía: docs/compliance/02-nfc-pruebas-manana.md.
 */
export default function VerifyDocumentRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <DocumentVerificationScreen />;
}
