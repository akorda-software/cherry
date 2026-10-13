import { describe, expect, it } from "vitest";

import {
  AGE_VERIFICATION_METHODS,
  isAgeVerified,
  isDocumentNotVerifiedReason,
  isProviderVerified,
  type AgeVerificationResponse,
  type ProviderCheckResponse
} from "./verification";

describe("age verification contract", () => {
  it("lists the methods the backend accepts", () => {
    expect(AGE_VERIFICATION_METHODS).toEqual(["nfc_dni", "nfc_passport", "provider", "eu_wallet"]);
  });

  it("recognises document_not_verified reasons", () => {
    expect(isDocumentNotVerifiedReason("untrusted_certificate")).toBe(true);
    expect(isDocumentNotVerifiedReason("underage")).toBe(false);
    expect(isDocumentNotVerifiedReason(42)).toBe(false);
  });

  it("is verified only with status verified", () => {
    const unverified: AgeVerificationResponse = {
      verification: { status: "unverified", method: null, verifiedAt: null },
      required: false
    };
    const verified: AgeVerificationResponse = {
      verification: { status: "verified", method: "nfc_dni", verifiedAt: "2026-10-09T12:00:00Z" },
      required: true
    };

    expect(isAgeVerified(unverified)).toBe(false);
    expect(isAgeVerified(verified)).toBe(true);
    expect(isAgeVerified({ verification: { ...verified.verification, status: "revoked" } })).toBe(false);
  });

  it("tells verified provider checks from pending ones", () => {
    const verified: ProviderCheckResponse = {
      result: "verified",
      verification: { status: "verified", method: "provider", verifiedAt: "2026-10-13T12:00:00Z" },
      required: false
    };
    const pending: ProviderCheckResponse = { result: "pending" };
    const inReview: ProviderCheckResponse = { result: "in_review" };

    expect(isProviderVerified(verified)).toBe(true);
    expect(isProviderVerified(pending)).toBe(false);
    expect(isProviderVerified(inReview)).toBe(false);
  });
});
