import { useCallback, useEffect, useRef, useState } from "react";

import type { AgeVerification, ProviderCheckResponse, ProviderSessionResponse } from "@cherry/contracts";

import { isApiError } from "../../../shared/api";
import { serverErrorCopy } from "../domain/verification-copy";
import type { VerificationError } from "./use-document-verification";

export type ProviderPhase = "intro" | "opening" | "checking" | "pending" | "in_review" | "success" | "error";

export interface ProviderVerificationState {
  phase: ProviderPhase;
  error: VerificationError | null;
  verification: AgeVerification | null;
}

/** Cómo se cerró el navegador: volviendo por el enlace del proveedor o cerrándolo a mano. */
export type BrowserOutcome = "returned" | "closed";

export interface ProviderVerificationDeps {
  /** `POST /api/me/verification/provider`. */
  startSession(callback: string): Promise<ProviderSessionResponse>;
  /** `POST /api/me/verification/provider/check`. */
  checkSession(sessionId: string): Promise<ProviderCheckResponse>;
  /** Abre la página del proveedor y espera a que el usuario vuelva. */
  openBrowser(url: string, returnUrl: string): Promise<BrowserOutcome>;
  /** Enlace de vuelta a la app (`<esquema>://verify/selfie/return`). */
  returnUrl: string;
  /** Espera entre consultas (inyectable en las pruebas). */
  sleep?(ms: number): Promise<void>;
  /** Tras verificarse (p. ej. recargar el bootstrap para activar el perfil). */
  onVerified?(): Promise<void> | void;
}

const INITIAL: ProviderVerificationState = { phase: "intro", error: null, verification: null };

/** Al volver del proveedor la decisión puede tardar unos segundos: tantas consultas, tan separadas. */
export const PROVIDER_POLL_ATTEMPTS = 5;
export const PROVIDER_POLL_INTERVAL_MS = 2_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Verificación con selfie y documento en un proveedor externo (Didit): el servidor abre una sesión,
 * la app la enseña en el navegador y, al volver, el servidor pregunta el resultado al proveedor.
 * La app nunca ve las fotos ni los datos del documento.
 */
export function useProviderVerification(deps: ProviderVerificationDeps) {
  const [state, setState] = useState<ProviderVerificationState>(INITIAL);
  const depsRef = useRef(deps);
  const sessionRef = useRef<ProviderSessionResponse | null>(null);
  const runRef = useRef(0);
  const mountedRef = useRef(true);

  depsRef.current = deps;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const update = useCallback((patch: Partial<ProviderVerificationState>) => {
    if (mountedRef.current) {
      setState((current) => ({ ...current, ...patch }));
    }
  }, []);

  const fail = useCallback(
    (error: unknown) => {
      const body = isApiError(error) ? (error.body as { retryAfter?: unknown } | undefined) : undefined;
      const code = isApiError(error) ? (error.code ?? null) : null;
      const retryAfterSeconds = typeof body?.retryAfter === "number" ? body.retryAfter : undefined;
      // Tras un resultado final la sesión ya no sirve: el siguiente intento abre otra.
      if (code !== "provider_error" && code !== null) {
        sessionRef.current = null;
      }
      const detail = code ?? (isApiError(error) ? `HTTP ${error.status ?? 0}` : "network");
      update({ phase: "error", error: { ...serverErrorCopy(code, { retryAfterSeconds }), detail } });
    },
    [update]
  );

  /** Pregunta el resultado; si el usuario acaba de terminar, insiste unos segundos. */
  const check = useCallback(
    async (attempts: number) => {
      const session = sessionRef.current;
      if (!session) {
        update({ phase: "intro" });
        return;
      }
      const runId = runRef.current;
      update({ phase: "checking", error: null });

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        let response: ProviderCheckResponse;
        try {
          response = await depsRef.current.checkSession(session.sessionId);
        } catch (error) {
          if (runId === runRef.current) {
            fail(error);
          }
          return;
        }
        if (runId !== runRef.current) {
          return;
        }

        if (response.result === "verified") {
          sessionRef.current = null;
          update({ phase: "success", verification: response.verification });
          try {
            await depsRef.current.onVerified?.();
          } catch {
            // El perfil se activa igual en la próxima carga del bootstrap.
          }
          return;
        }
        if (response.result === "in_review") {
          update({ phase: "in_review" });
          return;
        }
        if (attempt < attempts) {
          await (depsRef.current.sleep ?? defaultSleep)(PROVIDER_POLL_INTERVAL_MS);
          if (runId !== runRef.current) {
            return;
          }
        }
      }
      update({ phase: "pending" });
    },
    [fail, update]
  );

  /** Abre (o reabre) la página del proveedor y comprueba el resultado al volver. */
  const open = useCallback(async () => {
    const runId = ++runRef.current;
    update({ phase: "opening", error: null });

    let session = sessionRef.current;
    if (!session) {
      try {
        session = await depsRef.current.startSession(depsRef.current.returnUrl);
      } catch (error) {
        if (runId === runRef.current) {
          fail(error);
        }
        return;
      }
      if (runId !== runRef.current) {
        return;
      }
      sessionRef.current = session;
    }

    let outcome: BrowserOutcome;
    try {
      outcome = await depsRef.current.openBrowser(session.url, depsRef.current.returnUrl);
    } catch {
      outcome = "closed";
    }
    if (runId !== runRef.current) {
      return;
    }
    await check(outcome === "returned" ? PROVIDER_POLL_ATTEMPTS : 1);
  }, [check, fail, update]);

  /** «Ya he terminado» / «Comprobar otra vez». */
  const recheck = useCallback(() => {
    runRef.current += 1;
    void check(PROVIDER_POLL_ATTEMPTS);
  }, [check]);

  /** Tras un error: otra sesión si la anterior ya no sirve, o la misma si fue un fallo de red. */
  const retry = useCallback(() => {
    void open();
  }, [open]);

  const reset = useCallback(() => {
    runRef.current += 1;
    sessionRef.current = null;
    update(INITIAL);
  }, [update]);

  return { state, open, recheck, retry, reset };
}
