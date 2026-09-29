import { useCallback, useRef, useState } from "react";

import type { ReportReason } from "@snack/contracts";

import { MAX_REPORT_DETAILS_LENGTH } from "../domain/report-reasons";
import { blockProfile, reportProfile, type SafetyActionDeps } from "./safety-actions";

export type SafetyStep = "menu" | "report" | "block" | "reported" | "blocked";

export interface SafetyFlowOptions {
  profileId: string;
  deps: SafetyActionDeps;
  onBlocked?(): void;
  onReported?(): void;
}

export interface SafetyFlow {
  step: SafetyStep;
  reason: ReportReason | null;
  details: string;
  submitting: boolean;
  error: string | null;
  canSubmitReport: boolean;
  startReport(): void;
  startBlock(): void;
  back(): void;
  selectReason(reason: ReportReason): void;
  setDetails(details: string): void;
  submitReport(): Promise<void>;
  confirmBlock(): Promise<void>;
  reset(): void;
}

/**
 * Flujo de la hoja de seguridad: menú → reportar (motivo + detalles) → gracias
 * (con opción de bloquear también) · menú → bloquear (confirmación clara) → hecho.
 */
export function useSafetyFlow({ profileId, deps, onBlocked, onReported }: SafetyFlowOptions): SafetyFlow {
  const [step, setStep] = useState<SafetyStep>("menu");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetailsState] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const reset = useCallback(() => {
    setStep("menu");
    setReason(null);
    setDetailsState("");
    setSubmitting(false);
    setError(null);
    busy.current = false;
  }, []);

  const submitReport = useCallback(async () => {
    if (busy.current || reason === null) {
      return;
    }

    busy.current = true;
    setSubmitting(true);
    setError(null);
    const outcome = await reportProfile(deps, profileId, reason, details);
    busy.current = false;
    setSubmitting(false);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    setStep("reported");
    onReported?.();
  }, [deps, details, onReported, profileId, reason]);

  const confirmBlock = useCallback(async () => {
    if (busy.current) {
      return;
    }

    busy.current = true;
    setSubmitting(true);
    setError(null);
    const outcome = await blockProfile(deps, profileId);
    busy.current = false;
    setSubmitting(false);

    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }

    setStep("blocked");
    onBlocked?.();
  }, [deps, onBlocked, profileId]);

  return {
    step,
    reason,
    details,
    submitting,
    error,
    canSubmitReport: reason !== null && !submitting,
    startReport: () => {
      setError(null);
      setStep("report");
    },
    startBlock: () => {
      setError(null);
      setStep("block");
    },
    back: () => {
      setError(null);
      setStep((current) => (current === "report" || current === "block" ? "menu" : current));
    },
    selectReason: (next) => {
      setError(null);
      setReason(next);
    },
    setDetails: (next) => setDetailsState(next.slice(0, MAX_REPORT_DETAILS_LENGTH)),
    submitReport,
    confirmBlock,
    reset
  };
}
