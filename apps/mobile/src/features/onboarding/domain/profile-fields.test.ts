import { describe, expect, it } from "vitest";

import {
  BIO_MAX,
  bioLength,
  graphemeCount,
  insertBioStarter,
  normalizeDisplayName,
  suggestedFirstName,
  validateBio,
  validateDisplayName
} from "./profile-fields";

describe("display name", () => {
  it("normalizes spaces and validates length", () => {
    expect(normalizeDisplayName("  Lucía   María ")).toBe("Lucía María");
    expect(validateDisplayName("  Lucía ")).toEqual({ ok: true, value: "Lucía" });
    expect(validateDisplayName("   ")).toEqual({ ok: false, reason: "empty" });
    expect(validateDisplayName(null)).toEqual({ ok: false, reason: "empty" });
    expect(validateDisplayName("a".repeat(50)).ok).toBe(true);
    expect(validateDisplayName("a".repeat(51))).toEqual({ ok: false, reason: "too_long" });
  });

  it("suggests the first name of the account only when it looks like a name", () => {
    expect(suggestedFirstName("Lucía Fernández")).toBe("Lucía");
    expect(suggestedFirstName("José-Luis Pérez")).toBe("José-Luis");
    expect(suggestedFirstName("Nuevo+1727")).toBe("");
    expect(suggestedFirstName("demo2")).toBe("");
    expect(suggestedFirstName(null)).toBe("");
  });
});

describe("bio", () => {
  it("counts graphemes after trimming", () => {
    expect(bioLength("  hola  ")).toBe(4);
    expect(graphemeCount("🍙🍙")).toBe(2);
  });

  it("validates 20–240 characters", () => {
    expect(validateBio("Corta")).toEqual({ ok: false, reason: "too_short", length: 5 });
    expect(validateBio("Una bio con más de veinte caracteres.").ok).toBe(true);
    expect(validateBio("a".repeat(BIO_MAX)).ok).toBe(true);
    expect(validateBio("a".repeat(BIO_MAX + 1))).toEqual({ ok: false, reason: "too_long", length: BIO_MAX + 1 });
  });

  it("inserts a starter at the end (new line when there is text)", () => {
    expect(insertBioStarter("", "Me ganas si...")).toBe("Me ganas si... ");
    expect(insertBioStarter("Hola.  ", "Me ganas si...")).toBe("Hola.\nMe ganas si... ");
  });

  it("does not insert a starter that would overflow the limit", () => {
    const full = "a".repeat(BIO_MAX - 3);
    expect(insertBioStarter(full, "Me ganas si...")).toBe(full);
  });
});
