import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgeVerificationResponse } from "@snack/contracts";

import {
  DocumentNfcError,
  type DocumentReadProgress,
  type DocumentReadResult
} from "../../../../modules/document-nfc";
import { type DocumentVerificationDeps, useDocumentVerification } from "./use-document-verification";

const verified: AgeVerificationResponse = {
  verification: { status: "verified", method: "nfc_dni", verifiedAt: "2026-10-09T12:00:00Z" },
  required: false
};

function apiError(status: number, body: Record<string, unknown>) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    status,
    code: body.error as string,
    body
  });
}

function makeDeps(overrides: Partial<DocumentVerificationDeps> = {}) {
  let progress: ((event: DocumentReadProgress) => void) | null = null;
  const deps: DocumentVerificationDeps = {
    getNfcStatus: vi.fn().mockResolvedValue("enabled"),
    readDocument: vi.fn().mockResolvedValue({ dg1: "ZGcx", dg2: "ZGcy", sod: "c29k" }),
    cancelRead: vi.fn().mockResolvedValue(undefined),
    openNfcSettings: vi.fn().mockResolvedValue(undefined),
    addReadProgressListener: vi.fn((listener) => {
      progress = listener;
      return vi.fn();
    }),
    verify: vi.fn().mockResolvedValue(verified),
    ...overrides
  };
  return { deps, emit: (event: DocumentReadProgress) => progress?.(event) };
}

describe("useDocumentVerification", () => {
  it("intro → CAN → read → server → success, sending only the chip files", async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useDocumentVerification(deps));

    expect(result.current.state.phase).toBe("intro");
    await act(() => result.current.start());
    expect(result.current.state.phase).toBe("key");

    await act(() => result.current.submit({ can: "123456" }));

    expect(deps.readDocument).toHaveBeenCalledWith({ can: "123456" }, { messages: undefined });
    expect(deps.verify).toHaveBeenCalledWith({ dg1: "ZGcx", dg2: "ZGcy", sod: "c29k" });
    expect(result.current.state).toMatchObject({ phase: "success", verification: verified.verification });
  });

  it("shows read progress while reading", async () => {
    let finish: (value: DocumentReadResult) => void = () => undefined;
    const { deps, emit } = makeDeps({
      readDocument: vi.fn(() => new Promise<DocumentReadResult>((resolve) => (finish = resolve)))
    });
    const { result } = renderHook(() => useDocumentVerification(deps));

    act(() => void result.current.submit({ can: "123456" }));
    expect(result.current.state).toMatchObject({ phase: "reading", step: "waiting" });

    act(() => emit({ step: "reading_dg2" }));
    expect(result.current.state.step).toBe("reading_dg2");

    await act(async () => finish({ dg1: "a", dg2: "b", sod: "c" }));
    await waitFor(() => expect(result.current.state.phase).toBe("success"));
  });

  it("NFC off or missing stops before asking for the CAN", async () => {
    const off = makeDeps({ getNfcStatus: vi.fn().mockResolvedValue("disabled") });
    const { result } = renderHook(() => useDocumentVerification(off.deps));
    await act(() => result.current.start());
    expect(result.current.state.error).toMatchObject({ action: "settings", detail: "NFC_DISABLED" });

    act(() => result.current.openSettings());
    expect(off.deps.openNfcSettings).toHaveBeenCalled();

    const none = makeDeps({ getNfcStatus: vi.fn().mockResolvedValue("unavailable") });
    const second = renderHook(() => useDocumentVerification(none.deps));
    await act(() => second.result.current.start());
    expect(second.result.current.state.error).toMatchObject({ action: "none", detail: "NFC_UNAVAILABLE" });
  });

  it("a wrong CAN asks to edit it; a lost tag retries with the same key", async () => {
    const readDocument = vi
      .fn()
      .mockRejectedValueOnce(new DocumentNfcError("ACCESS_DENIED"))
      .mockRejectedValueOnce(new DocumentNfcError("TAG_LOST"))
      .mockResolvedValueOnce({ dg1: "a", dg2: "b", sod: "c" });
    const { deps } = makeDeps({ readDocument });
    const { result } = renderHook(() => useDocumentVerification(deps));

    await act(() => result.current.submit({ can: "111111" }));
    expect(result.current.state.error).toMatchObject({ title: "El CAN no coincide", action: "edit_key" });

    act(() => result.current.editKey());
    expect(result.current.state.phase).toBe("key");

    await act(() => result.current.submit({ can: "222222" }));
    expect(result.current.state.error?.action).toBe("retry");

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.state.phase).toBe("success"));
    expect(readDocument).toHaveBeenLastCalledWith({ can: "222222" }, expect.anything());
  });

  it("cancelling goes back to the key step without an error", async () => {
    const { deps } = makeDeps({ readDocument: vi.fn().mockRejectedValue(new DocumentNfcError("CANCELLED")) });
    const { result } = renderHook(() => useDocumentVerification(deps));

    await act(() => result.current.submit({ mrz: { documentNumber: "ZZ1", dateOfBirth: "900517", dateOfExpiry: "310517" } }));
    expect(result.current.state).toMatchObject({ phase: "key", kind: "passport", error: null });

    act(() => result.current.cancel());
    expect(deps.cancelRead).toHaveBeenCalled();
  });

  it("server errors keep the technical reason for development", async () => {
    const { deps } = makeDeps({
      verify: vi
        .fn()
        .mockRejectedValueOnce(apiError(422, { error: "document_not_verified", reason: "untrusted_certificate" }))
        .mockRejectedValueOnce(apiError(422, { error: "underage" }))
        .mockRejectedValueOnce(apiError(429, { error: "too_many_attempts", retryAfter: 600 }))
        .mockRejectedValueOnce(new TypeError("Network request failed"))
    });
    const { result } = renderHook(() => useDocumentVerification(deps));

    await act(() => result.current.submit({ can: "123456" }));
    expect(result.current.state.error).toMatchObject({ action: "retry", detail: "untrusted_certificate" });

    await act(() => result.current.submit({ can: "123456" }));
    expect(result.current.state.error).toMatchObject({ action: "none", detail: "underage" });

    await act(() => result.current.submit({ can: "123456" }));
    expect(result.current.state.error?.message).toBe("Vuelve a probar dentro de 10 minutos.");

    await act(() => result.current.submit({ can: "123456" }));
    expect(result.current.state.error).toMatchObject({ action: "retry", detail: "network" });
  });

  it("cancels any read when unmounting", () => {
    const { deps } = makeDeps();
    const { unmount } = renderHook(() => useDocumentVerification(deps));
    unmount();
    expect(deps.cancelRead).toHaveBeenCalled();
  });

  it("reset forgets everything", async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useDocumentVerification(deps));
    await act(() => result.current.submit({ can: "123456" }));
    act(() => result.current.reset());
    expect(result.current.state).toMatchObject({ phase: "intro", verification: null, error: null });

    act(() => result.current.retry());
    expect(result.current.state.phase).toBe("key");
  });
});
