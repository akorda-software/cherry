import { Platform } from "react-native";

import { apiErrorCode, friendlyErrorMessage } from "../../../shared/api";

/** De dónde viene el intento de entrar: un proveedor, el atajo de desarrollo o la sesión guardada. */
export type AuthAttempt = "google" | "apple" | "test" | "restore";

/** Cancelar la hoja de Google o Apple es una decisión, no un error: no se enseña nada. */
export function isAuthCancellation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: unknown }).code;
  if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED" || code === "SIGN_IN_CANCELLED") {
    return true;
  }

  return error instanceof Error && /cancel/i.test(error.message);
}

function hasHttpStatus(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { status?: unknown }).status === "number"
  );
}

const providerName: Record<"google" | "apple", string> = { google: "Google", apple: "Apple" };

/**
 * Mensaje amable (español de España) para un fallo al entrar. `null` si la persona canceló.
 * Nunca enseña códigos ni mensajes técnicos del proveedor.
 */
export function describeAuthError(error: unknown, attempt: AuthAttempt): string | null {
  if (isAuthCancellation(error)) {
    return null;
  }

  const code = apiErrorCode(error);

  if (code === "account_deleted") {
    return "Esta cuenta se borró y ya no se puede usar para entrar.";
  }

  if (attempt === "test" && code === "dev_test_login_disabled") {
    return "El acceso de pruebas está desactivado en este servidor.";
  }

  if (hasHttpStatus(error) || error instanceof TypeError) {
    const generic = friendlyErrorMessage(error, "");
    if (generic !== "") {
      return generic;
    }
  }

  const message = error instanceof Error ? error.message : "";

  if (attempt === "apple" && /not available/i.test(message)) {
    return "Entrar con Apple no está disponible en este dispositivo.";
  }

  if (attempt === "google" && Platform.OS === "android" && /play services/i.test(message)) {
    return "Para entrar con Google necesitas Google Play Services actualizado.";
  }

  switch (attempt) {
    case "google":
    case "apple":
      return `No hemos podido entrar con ${providerName[attempt]}. Inténtalo otra vez.`;
    case "test":
      return "No se ha podido entrar en modo pruebas. ¿Está el servidor en marcha?";
    case "restore":
      return "No hemos podido recuperar tu sesión. Vuelve a entrar, porfa.";
  }
}
