import { describe, expect, it } from "vitest";

import {
  holdInstruction,
  placementSteps,
  READ_STEP_COPY,
  READ_STEP_PROGRESS,
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

  it("explains where to place the document, step by step", () => {
    expect(placementSteps("android", "id_card")).toEqual(
      expect.arrayContaining([expect.stringContaining("a la altura de la cámara"), expect.stringContaining("funda")])
    );
    expect(placementSteps("ios", "passport")[0]).toContain("abierto por la página de tus datos");
  });

  it("covers every read step, including the automatic retry", () => {
    expect(READ_STEP_COPY.retrying).toContain("lo intentamos otra vez");
    expect(READ_STEP_PROGRESS.done).toBe(1);
    expect(READ_STEP_PROGRESS.waiting).toBe(0);
  });

  it("never mentions the photo while reading the chip: it is not read", () => {
    for (const text of Object.values(READ_STEP_COPY)) {
      expect(text).not.toMatch(/foto/i);
    }
  });

  it("says the selfie is out until next month when the monthly limit is reached", () => {
    expect(serverErrorCopy("provider_limit_reached")).toMatchObject({ title: "No disponible hasta el mes que viene", action: "none" });
    expect(serverErrorCopy("provider_limit_reached").message).toContain("NFC");
    expect(serverErrorCopy("unsupported_document").message).toContain("El TIE");
  });

  it("maps NFC errors to an action", () => {
    expect(readErrorCopy("ACCESS_DENIED", "id_card")).toMatchObject({ title: "El CAN no coincide", action: "edit_key" });
    expect(readErrorCopy("ACCESS_DENIED", "passport").action).toBe("edit_key");
    expect(readErrorCopy("ACCESS_DENIED", "id_card").offerMrz).toBe(true);
    expect(readErrorCopy("ACCESS_DENIED", "id_card", "mrz")).toMatchObject({
      title: "Los datos no coinciden",
      action: "edit_key"
    });
    expect(readErrorCopy("ACCESS_DENIED", "id_card", "mrz").offerMrz).toBeUndefined();
    expect(readErrorCopy("UNSUPPORTED_DOCUMENT", "id_card")).toMatchObject({ action: "none", offerMrz: true });
    expect(readErrorCopy("UNSUPPORTED_DOCUMENT", "id_card", "mrz").action).toBe("retry");
    expect(readErrorCopy("TIMEOUT", "id_card", "mrz").message).toContain("el documento");
    expect(readErrorCopy("NFC_DISABLED", "id_card").action).toBe("settings");
    expect(readErrorCopy("NFC_UNAVAILABLE", "id_card").action).toBe("none");
    // No culpa a la persona de moverlo: lo habitual es que el DNI no quede sobre la antena.
    expect(readErrorCopy("TAG_LOST", "id_card")).toMatchObject({ title: "Se ha cortado la conexión con el chip", action: "retry" });
    expect(readErrorCopy("TAG_LOST", "id_card").message).toContain("a la altura de la cámara");
    for (const code of ["TIMEOUT", "BUSY", "UNKNOWN"] as const) {
      expect(readErrorCopy(code, "id_card").action).toBe("retry");
    }
    // Con el CAN no tiene sentido repetir: se ofrecen los datos de la MRZ.
    expect(readErrorCopy("UNSUPPORTED_DOCUMENT", "passport").action).toBe("retry");
  });

  it("maps server errors without blaming the person", () => {
    // La cuenta ya no existe: solo queda cerrar la sesión.
    expect(serverErrorCopy("underage")).toMatchObject({ action: "sign_out" });
    expect(serverErrorCopy("underage").message).toContain("Hemos borrado tu cuenta");
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
