import { describe, expect, it } from "vitest";

import { isAgeVerificationPending } from "./bootstrap";

describe("isAgeVerificationPending", () => {
  it("is pending only when the instance requires it and the account is not verified", () => {
    expect(isAgeVerificationPending({ ageVerification: { required: true, status: "unverified" } })).toBe(true);
    expect(isAgeVerificationPending({ ageVerification: { required: true, status: "revoked" } })).toBe(true);
    expect(isAgeVerificationPending({ ageVerification: { required: true, status: "verified" } })).toBe(false);
    expect(isAgeVerificationPending({ ageVerification: { required: false, status: "unverified" } })).toBe(false);
  });

  it("older servers without the field never block", () => {
    expect(isAgeVerificationPending({})).toBe(false);
  });
});
