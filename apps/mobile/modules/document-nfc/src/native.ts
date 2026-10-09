import { requireOptionalNativeModule } from "expo";

import type { DocumentReadProgress, DocumentReadResult, NfcStatus } from "./types";

/** Clave tal como la recibe el nativo: el CAN o los tres datos de la MRZ. */
export type NativeReadKey = { can: string } | { documentNumber: string; dateOfBirth: string; dateOfExpiry: string };

/** Lo que exponen `DocumentNfcModule.kt` y `DocumentNfcModule.swift`. */
export interface DocumentNfcNativeModule {
  getStatus(): Promise<NfcStatus>;
  read(
    key: NativeReadKey,
    options: { timeoutMs: number; prompt?: string; reading?: string; success?: string }
  ): Promise<DocumentReadResult>;
  cancel(): Promise<void>;
  openSettings(): Promise<void>;
  addListener(event: "onProgress", listener: (event: DocumentReadProgress) => void): { remove(): void };
}

/** `null` en web, en Expo Go y en un dev client compilado antes de añadir el módulo. */
export function loadNativeModule(): DocumentNfcNativeModule | null {
  try {
    return requireOptionalNativeModule<DocumentNfcNativeModule>("DocumentNfc");
  } catch {
    return null;
  }
}
