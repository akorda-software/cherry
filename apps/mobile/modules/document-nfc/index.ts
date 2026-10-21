/**
 * Lectura NFC de documentos de identidad electrónicos (ICAO 9303): DNI 3.0/4.0, otros documentos
 * de identidad y pasaportes.
 *
 * Abre el canal seguro con el chip (PACE con el CAN; PACE o BAC con la MRZ en pasaportes) y
 * devuelve DG1 y EF.SOD sin interpretar, en base64. La foto del chip (DG2) no se lee. La
 * autenticación pasiva se hace en el servidor (`POST /api/me/verification/nfc`), nunca aquí: una
 * app manipulada podría mentir.
 *
 * El CAN y la MRZ solo viven en memoria durante la lectura: no se guardan ni se envían.
 * Android usa JMRTD; iOS, NFCPassportReader (AndyQ) incorporado con soporte de CAN. Ver README.md.
 */
import { DocumentNfcError, toDocumentNfcError } from "./src/errors";
import { loadNativeModule, type NativeReadKey } from "./src/native";
import type {
  DocumentAccessKey,
  DocumentReadProgress,
  DocumentReadResult,
  NfcStatus,
  ReadDocumentOptions
} from "./src/types";

export { DocumentNfcError, isDocumentNfcErrorCode, toDocumentNfcError } from "./src/errors";
export * from "./src/types";

const DEFAULT_TIMEOUT_MS = 90_000;

/** El CAN del DNI: 6 dígitos (esquina inferior derecha del anverso). */
export function isValidCan(can: string): boolean {
  return /^\d{6}$/.test(can);
}

/** Datos de la MRZ para BAC/PACE de pasaportes: número (letras y cifras) y fechas AAMMDD. */
export function isValidMrzKey(mrz: { documentNumber: string; dateOfBirth: string; dateOfExpiry: string }): boolean {
  return (
    /^[A-Z0-9<]{1,22}$/.test(mrz.documentNumber) && isYymmdd(mrz.dateOfBirth) && isYymmdd(mrz.dateOfExpiry)
  );
}

function isYymmdd(value: string): boolean {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** `unavailable` sin NFC (o sin el módulo nativo: web, Expo Go, dev client antiguo). */
export async function getNfcStatus(): Promise<NfcStatus> {
  const native = loadNativeModule();
  if (!native) {
    return "unavailable";
  }
  try {
    return await native.getStatus();
  } catch {
    return "unavailable";
  }
}

/** Lee DG1 y SOD (nunca la foto). Rechaza con `DocumentNfcError` (ver `DocumentNfcErrorCode`). */
export async function readDocument(key: DocumentAccessKey, options: ReadDocumentOptions = {}): Promise<DocumentReadResult> {
  const native = loadNativeModule();
  if (!native) {
    throw new DocumentNfcError("NFC_UNAVAILABLE");
  }

  let nativeKey: NativeReadKey;

  if ("can" in key) {
    const can = key.can.trim();
    if (!isValidCan(can)) {
      throw new DocumentNfcError("INVALID_KEY");
    }
    nativeKey = { can };
  } else {
    const mrz = { ...key.mrz, documentNumber: key.mrz.documentNumber.trim().toUpperCase() };
    if (!isValidMrzKey(mrz)) {
      throw new DocumentNfcError("INVALID_KEY");
    }
    nativeKey = mrz;
  }

  try {
    const result = await native.read(nativeKey, {
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      prompt: options.messages?.prompt,
      reading: options.messages?.reading,
      success: options.messages?.success
    });

    if (!result || !result.dg1 || !result.sod) {
      throw new DocumentNfcError("UNKNOWN", "Incomplete read");
    }

    return { dg1: result.dg1, sod: result.sod };
  } catch (error) {
    throw toDocumentNfcError(error);
  }
}

/** Cancela la lectura en curso (la promesa de `readDocument` rechaza con `CANCELLED`). */
export async function cancelRead(): Promise<void> {
  await loadNativeModule()?.cancel();
}

/** Abre los ajustes de NFC del sistema (Android). En iOS no hace nada: el NFC no se puede apagar. */
export async function openNfcSettings(): Promise<void> {
  await loadNativeModule()?.openSettings();
}

/** Progreso de la lectura. Devuelve la función para dejar de escuchar. */
export function addReadProgressListener(listener: (event: DocumentReadProgress) => void): () => void {
  const subscription = loadNativeModule()?.addListener("onProgress", listener);
  return () => subscription?.remove();
}
