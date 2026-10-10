import { describe, expect, it, vi } from "vitest";

import { REPORT_REASONS, type ProfileReport } from "@cherry/contracts";

import { normalizeReportDetails, REPORT_REASON_OPTIONS } from "../domain/report-reasons";
import { blockProfile, reportProfile, type SafetyActionDeps } from "./safety-actions";

function apiError(status: number, code?: string) {
  const error = new Error(code ?? "boom") as Error & { status: number; code?: string };
  error.status = status;
  error.code = code;
  return error;
}

const report: ProfileReport = {
  id: "r1",
  reason: "spam",
  details: null,
  status: "open",
  insertedAt: "2026-09-29T10:00:00Z"
};

function deps(overrides: Partial<SafetyActionDeps> = {}): SafetyActionDeps {
  return {
    block: vi.fn(async () => undefined),
    report: vi.fn(async () => report),
    ...overrides
  };
}

describe("report reasons", () => {
  it("offers every contract reason in Spanish", () => {
    expect(REPORT_REASON_OPTIONS.map((option) => option.value)).toEqual([...REPORT_REASONS]);
    expect(REPORT_REASON_OPTIONS.find((option) => option.value === "underage")?.label).toBe(
      "Parece menor de edad"
    );
  });

  it("trims, drops empty and caps details at 1000 chars", () => {
    expect(normalizeReportDetails("  hola  ")).toBe("hola");
    expect(normalizeReportDetails("   ")).toBeUndefined();
    expect(normalizeReportDetails(null)).toBeUndefined();
    expect(normalizeReportDetails("x".repeat(1200))).toHaveLength(1000);
  });
});

describe("blockProfile", () => {
  it("blocks", async () => {
    const d = deps();

    await expect(blockProfile(d, "p1")).resolves.toEqual({ ok: true, value: undefined });
    expect(d.block).toHaveBeenCalledWith("p1");
  });

  it("treats a vanished profile as blocked", async () => {
    const d = deps({ block: vi.fn(async () => Promise.reject(apiError(404, "profile_not_found"))) });

    await expect(blockProfile(d, "p1")).resolves.toMatchObject({ ok: true });
  });

  it("explains network failures", async () => {
    const d = deps({ block: vi.fn(async () => Promise.reject(apiError(0))) });

    await expect(blockProfile(d, "p1")).resolves.toEqual({
      ok: false,
      message: expect.stringMatching(/conexión/)
    });
  });
});

describe("reportProfile", () => {
  it("sends the reason and trimmed details", async () => {
    const d = deps();

    await expect(reportProfile(d, "p1", "harassment", "  me insultó  ")).resolves.toEqual({
      ok: true,
      value: report
    });
    expect(d.report).toHaveBeenCalledWith("p1", { reason: "harassment", details: "me insultó" });
  });

  it("omits empty details", async () => {
    const d = deps();

    await reportProfile(d, "p1", "spam", "   ");

    expect(d.report).toHaveBeenCalledWith("p1", { reason: "spam" });
  });

  it("maps backend validation codes to clear messages", async () => {
    const d = deps({ report: vi.fn(async () => Promise.reject(apiError(422, "details_too_long"))) });

    await expect(reportProfile(d, "p1", "other", "x")).resolves.toEqual({
      ok: false,
      message: expect.stringMatching(/1000/)
    });
  });
});
