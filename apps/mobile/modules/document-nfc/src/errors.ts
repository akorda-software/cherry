import { DOCUMENT_NFC_ERROR_CODES, type DocumentNfcErrorCode } from "./types";

export class DocumentNfcError extends Error {
  readonly code: DocumentNfcErrorCode;

  constructor(code: DocumentNfcErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DocumentNfcError";
    this.code = code;
  }
}

export function isDocumentNfcErrorCode(value: unknown): value is DocumentNfcErrorCode {
  return typeof value === "string" && (DOCUMENT_NFC_ERROR_CODES as readonly string[]).includes(value);
}

/** Convierte el rechazo del nativo (Expo `CodedException`: `code` + `message`) en un error tipado. */
export function toDocumentNfcError(error: unknown): DocumentNfcError {
  if (error instanceof DocumentNfcError) {
    return error;
  }

  const code = typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const message = error instanceof Error ? error.message : undefined;
  // Expo prefija a veces el código con "ERR_".
  const normalized = typeof code === "string" ? code.replace(/^ERR_/, "") : code;

  return new DocumentNfcError(isDocumentNfcErrorCode(normalized) ? normalized : "UNKNOWN", message);
}
