import { useCallback, useEffect, useRef, useState } from "react";

import type { AgeVerification, AgeVerificationResponse, NfcVerificationRequest } from "@cherry/contracts";

import {
  type DocumentAccessKey,
  type DocumentReadProgress,
  type DocumentReadResult,
  type DocumentReadStep,
  type NfcStatus,
  type ReadDocumentOptions,
  toDocumentNfcError
} from "../../../../modules/document-nfc";
import { isApiError } from "../../../shared/api";
import {
  type DocumentKind,
  readErrorCopy,
  serverErrorCopy,
  type VerificationErrorCopy
} from "../domain/verification-copy";

export type VerificationPhase = "intro" | "key" | "reading" | "sending" | "success" | "error";

export interface VerificationError extends VerificationErrorCopy {
  /** Código técnico (motivo del servidor o código NFC), para las pruebas en desarrollo. */
  detail: string | null;
}

export interface VerificationState {
  phase: VerificationPhase;
  kind: DocumentKind;
  step: DocumentReadStep | null;
  error: VerificationError | null;
  verification: AgeVerification | null;
}

export interface DocumentVerificationDeps {
  getNfcStatus(): Promise<NfcStatus>;
  readDocument(key: DocumentAccessKey, options?: ReadDocumentOptions): Promise<DocumentReadResult>;
  cancelRead(): Promise<void>;
  openNfcSettings(): Promise<void>;
  addReadProgressListener(listener: (event: DocumentReadProgress) => void): () => void;
  /** `POST /api/me/verification/nfc`. */
  verify(request: NfcVerificationRequest): Promise<AgeVerificationResponse>;
  /** Textos de la hoja del sistema (iOS). */
  readMessages?: ReadDocumentOptions["messages"];
}

const INITIAL: VerificationState = { phase: "intro", kind: "id_card", step: null, error: null, verification: null };

/**
 * Flujo de verificación: explicación → CAN (o datos del pasaporte) → lectura NFC → envío al
 * servidor → éxito o error. La clave de acceso solo vive en memoria mientras dura el flujo.
 */
export function useDocumentVerification(deps: DocumentVerificationDeps) {
  const [state, setState] = useState<VerificationState>(INITIAL);
  const depsRef = useRef(deps);
  const keyRef = useRef<DocumentAccessKey | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  depsRef.current = deps;

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = depsRef.current.addReadProgressListener((event) => {
      if (mountedRef.current) {
        setState((current) => (current.phase === "reading" ? { ...current, step: event.step } : current));
      }
    });

    return () => {
      mountedRef.current = false;
      keyRef.current = null;
      unsubscribe();
      void depsRef.current.cancelRead().catch(() => undefined);
    };
  }, []);

  const update = useCallback((patch: Partial<VerificationState>) => {
    if (mountedRef.current) {
      setState((current) => ({ ...current, ...patch }));
    }
  }, []);

  const fail = useCallback(
    (error: VerificationErrorCopy, detail: string | null) => update({ phase: "error", step: null, error: { ...error, detail } }),
    [update]
  );

  /** Comprueba el NFC antes de pedir la clave. */
  const start = useCallback(async () => {
    const status = await depsRef.current.getNfcStatus();
    if (status === "unavailable") {
      fail(readErrorCopy("NFC_UNAVAILABLE", "id_card"), "NFC_UNAVAILABLE");
    } else if (status === "disabled") {
      fail(readErrorCopy("NFC_DISABLED", "id_card"), "NFC_DISABLED");
    } else {
      update({ phase: "key", error: null });
    }
  }, [fail, update]);

  const setKind = useCallback((kind: DocumentKind) => update({ kind }), [update]);

  const run = useCallback(
    async (key: DocumentAccessKey) => {
      const runId = ++runRef.current;
      const kind: DocumentKind = "can" in key ? "id_card" : "passport";
      keyRef.current = key;
      update({ phase: "reading", kind, step: "waiting", error: null });

      let document: DocumentReadResult;
      try {
        document = await depsRef.current.readDocument(key, { messages: depsRef.current.readMessages });
      } catch (error) {
        if (runId !== runRef.current) {
          return;
        }
        const { code } = toDocumentNfcError(error);
        if (code === "CANCELLED") {
          update({ phase: "key", step: null });
        } else {
          fail(readErrorCopy(code, kind), code);
        }
        return;
      }

      if (runId !== runRef.current) {
        return;
      }
      update({ phase: "sending", step: null });

      try {
        const response = await depsRef.current.verify(document);
        keyRef.current = null;
        update({ phase: "success", verification: response.verification });
      } catch (error) {
        if (runId !== runRef.current) {
          return;
        }
        const body = isApiError(error) ? (error.body as { reason?: unknown; retryAfter?: unknown } | undefined) : undefined;
        const code = isApiError(error) ? (error.code ?? null) : null;
        const reason = typeof body?.reason === "string" ? body.reason : null;
        const retryAfterSeconds = typeof body?.retryAfter === "number" ? body.retryAfter : undefined;

        if (code === "already_verified") {
          keyRef.current = null;
        }
        fail(serverErrorCopy(code, { retryAfterSeconds }), reason ?? code ?? (isApiError(error) ? `HTTP ${error.status ?? 0}` : "network"));
      }
    },
    [fail, update]
  );

  /** Lee el documento con la clave dada y envía los datos. */
  const submit = useCallback((key: DocumentAccessKey) => run(key), [run]);

  /** Vuelve a intentar con la misma clave. */
  const retry = useCallback(() => {
    if (keyRef.current) {
      void run(keyRef.current);
    } else {
      update({ phase: "key", error: null });
    }
  }, [run, update]);

  const cancel = useCallback(() => {
    runRef.current += 1;
    update({ phase: "key", step: null });
    void depsRef.current.cancelRead().catch(() => undefined);
  }, [update]);

  const editKey = useCallback(() => update({ phase: "key", error: null, step: null }), [update]);

  const openSettings = useCallback(() => {
    void depsRef.current.openNfcSettings().catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1;
    keyRef.current = null;
    update(INITIAL);
  }, [update]);

  return { state, start, setKind, submit, retry, cancel, editKey, openSettings, reset };
}
