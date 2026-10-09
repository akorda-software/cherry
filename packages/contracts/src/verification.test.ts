import { describe, expect, it } from "vitest";

import {
  AGE_VERIFICATION_METHODS,
  isAgeVerified,
  isDocumentNotVerifiedReason,
  type AgeVerificationResponse
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
});
