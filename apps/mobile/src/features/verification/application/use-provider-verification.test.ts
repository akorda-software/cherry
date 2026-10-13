import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProviderCheckResponse } from "@cherry/contracts";

import { PROVIDER_POLL_ATTEMPTS, type ProviderVerificationDeps, useProviderVerification } from "./use-provider-verification";

const SESSION = { sessionId: "8aff9c52-07cf-432c-9712-bac4a6048da5", url: "https://verify.example/s/abc" };
const RETURN_URL = "cherry://verify/selfie/return";

const verified: ProviderCheckResponse = {
  result: "verified",
  verification: { status: "verified", method: "provider", verifiedAt: "2026-10-13T12:00:00Z" },
  required: true
};

function apiError(status: number, body: Record<string, unknown>) {
  return Object.assign(new Error(`Request failed with status ${status}`), {
    status,
    code: body.error as string,
    body
  });
}

function makeDeps(overrides: Partial<ProviderVerificationDeps> = {}): ProviderVerificationDeps {
  return {
    startSession: vi.fn().mockResolvedValue(SESSION),
    checkSession: vi.fn().mockResolvedValue(verified),
    openBrowser: vi.fn().mockResolvedValue("returned"),
    returnUrl: RETURN_URL,
    sleep: vi.fn().mockResolvedValue(undefined),
    onVerified: vi.fn(),
    ...overrides
  };
}

describe("useProviderVerification", () => {
  it("opens a session in the browser and activates the profile when approved", async () => {
    const deps = makeDeps();
    const { result } = renderHook(() => useProviderVerification(deps));

    expect(result.current.state.phase).toBe("intro");
    await act(() => result.current.open());

    expect(deps.startSession).toHaveBeenCalledWith(RETURN_URL);
    expect(deps.openBrowser).toHaveBeenCalledWith(SESSION.url, RETURN_URL);
    expect(deps.checkSession).toHaveBeenCalledWith(SESSION.sessionId);
    expect(result.current.state).toMatchObject({ phase: "success", verification: { method: "provider" } });
    expect(deps.onVerified).toHaveBeenCalledTimes(1);
  });

  it("keeps asking for a few seconds after returning, then offers to continue", async () => {
    const deps = makeDeps({ checkSession: vi.fn().mockResolvedValue({ result: "pending" }) });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());

    expect(deps.checkSession).toHaveBeenCalledTimes(PROVIDER_POLL_ATTEMPTS);
    expect(deps.sleep).toHaveBeenCalledTimes(PROVIDER_POLL_ATTEMPTS - 1);
    expect(result.current.state.phase).toBe("pending");
  });

  it("asks once when the browser was closed by hand and reuses the session to continue", async () => {
    const deps = makeDeps({
      openBrowser: vi.fn().mockResolvedValue("closed"),
      checkSession: vi.fn().mockResolvedValueOnce({ result: "pending" }).mockResolvedValue(verified)
    });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());
    expect(deps.checkSession).toHaveBeenCalledTimes(1);
    expect(result.current.state.phase).toBe("pending");

    await act(() => result.current.open());
    expect(deps.startSession).toHaveBeenCalledTimes(1);
    expect(deps.openBrowser).toHaveBeenCalledTimes(2);
    expect(result.current.state.phase).toBe("success");
  });

  it("shows the manual review state and checks again on demand", async () => {
    const deps = makeDeps({
      checkSession: vi.fn().mockResolvedValueOnce({ result: "in_review" }).mockResolvedValue(verified)
    });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());
    expect(result.current.state.phase).toBe("in_review");

    await act(async () => {
      result.current.recheck();
    });
    expect(result.current.state.phase).toBe("success");
  });

  it("maps server errors and opens a new session after a final decision", async () => {
    const deps = makeDeps({
      checkSession: vi
        .fn()
        .mockRejectedValueOnce(apiError(422, { error: "verification_declined" }))
        .mockResolvedValue(verified)
    });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());
    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toMatchObject({ action: "retry", detail: "verification_declined" });

    await act(async () => {
      result.current.retry();
    });
    expect(deps.startSession).toHaveBeenCalledTimes(2);
    expect(result.current.state.phase).toBe("success");
  });

  it("signs out after a minor's account is erased", async () => {
    const deps = makeDeps({
      checkSession: vi.fn().mockRejectedValue(apiError(422, { error: "underage", accountDeleted: true }))
    });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());

    expect(result.current.state.error).toMatchObject({ action: "sign_out" });
    expect(deps.onVerified).not.toHaveBeenCalled();
  });

  it("reports a provider that is not configured without opening the browser", async () => {
    const deps = makeDeps({
      startSession: vi.fn().mockRejectedValue(apiError(503, { error: "age_verification_unavailable" }))
    });
    const { result } = renderHook(() => useProviderVerification(deps));

    await act(() => result.current.open());

    expect(deps.openBrowser).not.toHaveBeenCalled();
    expect(result.current.state.error).toMatchObject({ title: "La comprobación no está disponible" });
  });
});
