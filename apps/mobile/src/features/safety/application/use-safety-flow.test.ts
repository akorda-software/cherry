import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProfileReport } from "@snack/contracts";

import type { SafetyActionDeps } from "./safety-actions";
import { useSafetyFlow } from "./use-safety-flow";

const report: ProfileReport = {
  id: "r1",
  reason: "harassment",
  details: "x",
  status: "open",
  insertedAt: "2026-09-29T10:00:00Z"
};

function apiError(status: number, code?: string) {
  const error = new Error(code ?? "boom") as Error & { status: number; code?: string };
  error.status = status;
  error.code = code;
  return error;
}

function setup(overrides: Partial<SafetyActionDeps> = {}) {
  const deps: SafetyActionDeps = {
    block: vi.fn(async () => undefined),
    report: vi.fn(async () => report),
    ...overrides
  };
  const onBlocked = vi.fn();
  const onReported = vi.fn();
  const hook = renderHook(() => useSafetyFlow({ profileId: "p1", deps, onBlocked, onReported }));
  return { ...hook, deps, onBlocked, onReported };
}

describe("useSafetyFlow", () => {
  it("reports with a reason and optional details, then thanks", async () => {
    const { result, deps, onReported } = setup();

    act(() => result.current.startReport());
    expect(result.current.step).toBe("report");
    expect(result.current.canSubmitReport).toBe(false);

    act(() => {
      result.current.selectReason("harassment");
      result.current.setDetails("  me insultó  ");
    });
    expect(result.current.canSubmitReport).toBe(true);

    await act(async () => {
      await result.current.submitReport();
    });

    expect(deps.report).toHaveBeenCalledWith("p1", { reason: "harassment", details: "me insultó" });
    expect(result.current.step).toBe("reported");
    expect(onReported).toHaveBeenCalledTimes(1);
  });

  it("blocks after an explicit confirmation", async () => {
    const { result, deps, onBlocked } = setup();

    act(() => result.current.startBlock());
    expect(result.current.step).toBe("block");
    expect(deps.block).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmBlock();
    });

    expect(deps.block).toHaveBeenCalledWith("p1");
    expect(result.current.step).toBe("blocked");
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it("offers blocking right after a report", async () => {
    const { result, deps } = setup();

    act(() => {
      result.current.startReport();
      result.current.selectReason("spam");
    });
    await act(async () => {
      await result.current.submitReport();
    });
    await act(async () => {
      await result.current.confirmBlock();
    });

    expect(deps.block).toHaveBeenCalledWith("p1");
    expect(result.current.step).toBe("blocked");
  });

  it("keeps the step and explains the problem when something fails", async () => {
    const { result } = setup({ block: vi.fn(async () => Promise.reject(apiError(0))) });

    act(() => result.current.startBlock());
    await act(async () => {
      await result.current.confirmBlock();
    });

    expect(result.current.step).toBe("block");
    expect(result.current.error).toMatch(/conexión/);
    expect(result.current.submitting).toBe(false);
  });

  it("goes back to the menu and resets", () => {
    const { result } = setup();

    act(() => result.current.startReport());
    act(() => result.current.back());
    expect(result.current.step).toBe("menu");

    act(() => {
      result.current.startReport();
      result.current.selectReason("other");
      result.current.reset();
    });
    expect(result.current.reason).toBeNull();
    expect(result.current.step).toBe("menu");
  });
});
