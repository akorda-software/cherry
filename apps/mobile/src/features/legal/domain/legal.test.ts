import { describe, expect, it } from "vitest";
import { canAccept, emptyDeclarations, needsLegalAcceptance, type LegalPublication } from "./legal";

const publication: LegalPublication = {
  version: "test", fingerprint: "test-hash", ready: true,
  termsText: "Condiciones", adulthoodText: "Mayoría de edad", sensitiveText: "Consentimiento explícito",
  documents: [{ slug: "privacidad", title: "Privacidad", intro: "Información", sections: [] }]
};

describe("independent legal decisions", () => {
  it("starts unchecked and requires all three separate decisions", () => {
    expect(canAccept(publication, emptyDeclarations)).toBe(false);
    const yes = { termsAccepted: true, adulthoodConfirmed: true, sensitiveConsent: true };
    expect(canAccept(publication, yes)).toBe(true);
    for (const key of Object.keys(yes)) {
      expect(canAccept(publication, { ...yes, [key]: false })).toBe(false);
    }
    expect(canAccept({ ...publication, ready: false }, yes)).toBe(false);
    expect(canAccept({ ...publication, documents: [] }, yes)).toBe(false);
  });

  it("does not impose the staged gate on older servers or when deliberately disabled", () => {
    expect(needsLegalAcceptance(undefined)).toBe(false);
    const status = { required: true, accepted: false, ready: true, version: "test", fingerprint: "hash" };
    expect(needsLegalAcceptance(status)).toBe(true);
    expect(needsLegalAcceptance({ ...status, required: false })).toBe(false);
    expect(needsLegalAcceptance({ ...status, accepted: true })).toBe(false);
  });
});
