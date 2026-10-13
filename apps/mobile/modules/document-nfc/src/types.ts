/** Clave de acceso al chip: CAN (6 dígitos de la tarjeta) o datos de la MRZ (pasaportes). */
export type DocumentAccessKey =
  | { can: string }
  | {
      mrz: {
        /** Número del documento tal como aparece en la MRZ (sin el dígito de control). */
        documentNumber: string;
        /** AAMMDD */
        dateOfBirth: string;
        /** AAMMDD */
        dateOfExpiry: string;
      };
    };

/** Ficheros del chip tal cual, en base64: lo que espera `POST /api/me/verification/nfc`. */
export interface DocumentReadResult {
  dg1: string;
  dg2: string;
  sod: string;
}

export type NfcStatus = "unavailable" | "disabled" | "enabled";

/**
 * Fases de la lectura que emite el nativo (para el texto de estado). `retrying`: se cortó la
 * conexión con el chip y la lectura vuelve a empezar sola en cuanto lo detecta (solo Android).
 */
export type DocumentReadStep =
  | "waiting"
  | "connecting"
  | "authenticating"
  | "reading_dg1"
  | "reading_dg2"
  | "reading_sod"
  | "retrying"
  | "done";

export interface DocumentReadProgress {
  step: DocumentReadStep;
}

export interface ReadDocumentOptions {
  /** Tiempo máximo esperando a que se acerque el documento y se lea (ms). Por defecto 90 s. */
  timeoutMs?: number;
  /** Textos de la hoja del sistema en iOS. */
  messages?: {
    prompt?: string;
    reading?: string;
    success?: string;
  };
}

export const DOCUMENT_NFC_ERROR_CODES = [
  "NFC_UNAVAILABLE",
  "NFC_DISABLED",
  "ACCESS_DENIED",
  "TAG_LOST",
  "UNSUPPORTED_DOCUMENT",
  "CANCELLED",
  "TIMEOUT",
  "BUSY",
  "INVALID_KEY",
  "UNKNOWN"
] as const;

/**
 * - `NFC_UNAVAILABLE`: el móvil no tiene NFC (o es web).
 * - `NFC_DISABLED`: NFC apagado en ajustes (solo Android).
 * - `ACCESS_DENIED`: el chip rechazó la clave (CAN o MRZ incorrectos).
 * - `TAG_LOST`: se perdió la conexión con el chip (documento separado o mal colocado) y no se
 *   recuperó tras los reintentos automáticos.
 * - `UNSUPPORTED_DOCUMENT`: no es un documento electrónico compatible (sin PACE/BAC, otra tarjeta…).
 * - `CANCELLED`: lo canceló la persona (o la app).
 * - `TIMEOUT`: no se acercó ningún documento a tiempo.
 * - `BUSY`: ya hay una lectura en curso.
 * - `INVALID_KEY`: el CAN o la MRZ no tienen el formato correcto (no se llega a leer).
 */
export type DocumentNfcErrorCode = (typeof DOCUMENT_NFC_ERROR_CODES)[number];
