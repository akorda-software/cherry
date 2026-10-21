import { describe, expect, it, vi } from "vitest";

import type { AgeVerificationResponse } from "@cherry/contracts";

import type { HttpClient } from "./auth-api";
import { createVerificationApi } from "./verification-api";

function createMockHttpClient() {
  return { get: vi.fn(), post: vi.fn(), put: vi.fn() } as unknown as HttpClient;
}

const verified: AgeVerificationResponse = {
  verification: { status: "verified", method: "nfc_dni", verifiedAt: "2026-10-09T12:00:00Z" },
  required: false
};

describe("createVerificationApi", () => {
  it("GETs the verification status", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce(verified);

    await expect(createVerificationApi(http).get()).resolves.toEqual(verified);
    expect(http.get).toHaveBeenCalledWith("/api/me/verification");
  });

  it("GETs the NFC countries", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.get).mockResolvedValueOnce({ countries: ["ES", "PT"] });

    await expect(createVerificationApi(http).nfcCountries()).resolves.toEqual({ countries: ["ES", "PT"] });
    expect(http.get).toHaveBeenCalledWith("/api/me/verification/nfc/countries");
  });

  it("POSTs only DG1 and the SOD", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce(verified);
    const request = { dg1: "ZGcx", dg2: "ZGcy", sod: "c29k", can: "123456" } as never;

    await expect(createVerificationApi(http).verifyNfc(request)).resolves.toEqual(verified);
    expect(http.post).toHaveBeenCalledWith("/api/me/verification/nfc", {
      dg1: "ZGcx",
      sod: "c29k"
    });
  });

  it("opens a provider session with the callback", async () => {
    const http = createMockHttpClient();
    const session = { sessionId: "8aff9c52-07cf-432c-9712-bac4a6048da5", url: "https://verify.example/s/abc" };
    vi.mocked(http.post).mockResolvedValueOnce(session);

    await expect(createVerificationApi(http).startProvider("cherry://verify/selfie")).resolves.toEqual(session);
    expect(http.post).toHaveBeenCalledWith("/api/me/verification/provider", { callback: "cherry://verify/selfie" });
  });

  it("checks a provider session by id", async () => {
    const http = createMockHttpClient();
    vi.mocked(http.post).mockResolvedValueOnce({ result: "pending" });

    await expect(createVerificationApi(http).checkProvider("8aff9c52-07cf-432c-9712-bac4a6048da5")).resolves.toEqual({
      result: "pending"
    });
    expect(http.post).toHaveBeenCalledWith("/api/me/verification/provider/check", {
      sessionId: "8aff9c52-07cf-432c-9712-bac4a6048da5"
    });
  });
});
