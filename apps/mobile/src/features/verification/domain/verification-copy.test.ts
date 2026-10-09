import { describe, expect, it } from "vitest";

import {
  holdInstruction,
  readErrorCopy,
  sanitizeCan,
  sanitizeDocumentNumber,
  serverErrorCopy,
  toMrzDate
} from "./verification-copy";

describe("verification copy", () => {
  it("keeps only six digits of the CAN", () => {
    expect(sanitizeCan("12 34-56789")).toBe("123456");
    expect(sanitizeCan("abc")).toBe("");
  });

  it("turns DD/MM/AAAA into the MRZ AAMMDD and rejects impossible dates", () => {
    expect(toMrzDate("17/05/1990")).toBe("900517");
    expect(toMrzDate("1/2/2031")).toBe("310201");
    expect(toMrzDate("17051990")).toBe("900517");
    expect(toMrzDate("31/02/1990")).toBeNull();
    expect(toMrzDate("1990-05-17")).toBeNull();
    expect(toMrzDate("")).toBeNull();
  });

  it("normalises passport numbers", () => {
    expect(sanitizeDocumentNumber(" zz 123-4567 ")).toBe("ZZ1234567");
  });

  it("tells where to hold the document on each platform", () => {
    expect(holdInstruction("ios", "id_card")).toContain("parte de arriba del iPhone");
    expect(holdInstruction("android", "passport")).toContain("Apoya el pasaporte");
  });

  it("maps NFC errors to an action", () => {
    expect(readErrorCopy("ACCESS_DENIED", "id_card")).toMatchObject({ title: "El CAN no coincide", action: "edit_key" });
    expect(readErrorCopy("ACCESS_DENIED", "passport").action).toBe("edit_key");
    expect(readErrorCopy("NFC_DISABLED", "id_card").action).toBe("settings");
    expect(readErrorCopy("NFC_UNAVAILABLE", "id_card").action).toBe("none");
    expect(readErrorCopy("TAG_LOST", "id_card").message).toContain("Deja el DNI quieto");
    for (const code of ["UNSUPPORTED_DOCUMENT", "TIMEOUT", "BUSY", "UNKNOWN"] as const) {
      expect(readErrorCopy(code, "id_card").action).toBe("retry");
    }
  });

  it("maps server errors without blaming the person", () => {
    expect(serverErrorCopy("underage")).toMatchObject({ action: "none" });
    expect(serverErrorCopy("underage").message).toContain("No hemos guardado nada");
    expect(serverErrorCopy("document_already_used").title).toContain("otra cuenta");
    expect(serverErrorCopy("too_many_attempts", { retryAfterSeconds: 61 }).message).toBe("Vuelve a probar dentro de 2 minutos.");
    expect(serverErrorCopy("too_many_attempts", { retryAfterSeconds: 30 }).message).toBe("Vuelve a probar dentro de 1 minuto.");
    expect(serverErrorCopy("document_not_verified").action).toBe("retry");
    expect(serverErrorCopy("age_verification_unavailable").action).toBe("none");
    expect(serverErrorCopy("already_verified").action).toBe("none");
    expect(serverErrorCopy("verification_revoked").action).toBe("none");
    expect(serverErrorCopy(null).action).toBe("retry");
  });

  it("never sells anything", () => {
    const all = [
      ...["underage", "document_already_used", "too_many_attempts", null].map((code) => serverErrorCopy(code)),
      readErrorCopy("UNKNOWN", "id_card")
    ]
      .map((copy) => `${copy.title} ${copy.message}`)
      .join(" ")
      .toLowerCase();
    for (const word of ["gratis", "sin trucos", "muros de pago", "código abierto"]) {
      expect(all).not.toContain(word);
    }
  });
});
