import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentNfcNativeModule } from "./src/native";

const native = vi.hoisted(() => ({ current: null as DocumentNfcNativeModule | null }));

vi.mock("./src/native", () => ({ loadNativeModule: () => native.current }));

import {
  addReadProgressListener,
  cancelRead,
  DocumentNfcError,
  getNfcStatus,
  isValidCan,
  isValidMrzKey,
  readDocument,
  toDocumentNfcError
} from "./index";

function fakeNative(overrides: Partial<DocumentNfcNativeModule> = {}): DocumentNfcNativeModule {
  return {
    getStatus: vi.fn().mockResolvedValue("enabled"),
    read: vi.fn().mockResolvedValue({ dg1: "ZGcx", sod: "c29k" }),
    cancel: vi.fn().mockResolvedValue(undefined),
    openSettings: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
    ...overrides
  };
}

beforeEach(() => {
  native.current = null;
});

describe("validation", () => {
  it("accepts only 6-digit CANs", () => {
    expect(isValidCan("123456")).toBe(true);
    expect(isValidCan("12345")).toBe(false);
    expect(isValidCan("1234567")).toBe(false);
    expect(isValidCan("12a456")).toBe(false);
  });

  it("checks the MRZ key fields", () => {
    expect(isValidMrzKey({ documentNumber: "ZZ1234567", dateOfBirth: "900517", dateOfExpiry: "310517" })).toBe(true);
    expect(isValidMrzKey({ documentNumber: "zz1234567", dateOfBirth: "900517", dateOfExpiry: "310517" })).toBe(false);
    expect(isValidMrzKey({ documentNumber: "ZZ1234567", dateOfBirth: "901317", dateOfExpiry: "310517" })).toBe(false);
    expect(isValidMrzKey({ documentNumber: "", dateOfBirth: "900517", dateOfExpiry: "310517" })).toBe(false);
  });
});

describe("without the native module (web, Expo Go, old dev client)", () => {
  it("reports NFC as unavailable and refuses to read", async () => {
    await expect(getNfcStatus()).resolves.toBe("unavailable");
    await expect(readDocument({ can: "123456" })).rejects.toMatchObject({ code: "NFC_UNAVAILABLE" });
    await expect(cancelRead()).resolves.toBeUndefined();
    expect(() => addReadProgressListener(() => undefined)()).not.toThrow();
  });
});

describe("with the native module", () => {
  it("reads with the CAN and returns only DG1 and the SOD", async () => {
    native.current = fakeNative({
      read: vi.fn().mockResolvedValue({ dg1: "ZGcx", sod: "c29k", extra: "x" })
    });

    await expect(readDocument({ can: " 123456 " })).resolves.toEqual({ dg1: "ZGcx", sod: "c29k" });
    expect(native.current.read).toHaveBeenCalledWith(
      { can: "123456" },
      expect.objectContaining({ timeoutMs: 90_000 })
    );
  });

  it("reads passports with the MRZ data (uppercased) and custom messages", async () => {
    native.current = fakeNative();

    await readDocument(
      { mrz: { documentNumber: "zz1234567", dateOfBirth: "900517", dateOfExpiry: "310517" } },
      { timeoutMs: 5_000, messages: { prompt: "Acerca el pasaporte" } }
    );

    expect(native.current.read).toHaveBeenCalledWith(
      { documentNumber: "ZZ1234567", dateOfBirth: "900517", dateOfExpiry: "310517" },
      { timeoutMs: 5_000, prompt: "Acerca el pasaporte", reading: undefined, success: undefined }
    );
  });

  it("rejects malformed keys before touching NFC", async () => {
    native.current = fakeNative();

    await expect(readDocument({ can: "12345" })).rejects.toMatchObject({ code: "INVALID_KEY" });
    expect(native.current.read).not.toHaveBeenCalled();
  });

  it("maps native errors to typed codes", async () => {
    for (const code of ["ACCESS_DENIED", "TAG_LOST", "CANCELLED", "NFC_DISABLED", "ERR_TIMEOUT"]) {
      native.current = fakeNative({ read: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code })) });
      const error = await readDocument({ can: "123456" }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DocumentNfcError);
      expect((error as DocumentNfcError).code).toBe(code.replace(/^ERR_/, ""));
    }
  });

  it("unknown failures and incomplete reads are UNKNOWN", async () => {
    native.current = fakeNative({ read: vi.fn().mockRejectedValue(new Error("boom")) });
    await expect(readDocument({ can: "123456" })).rejects.toMatchObject({ code: "UNKNOWN", message: "boom" });

    native.current = fakeNative({ read: vi.fn().mockResolvedValue({ dg1: "ZGcx", sod: "" }) });
    await expect(readDocument({ can: "123456" })).rejects.toMatchObject({ code: "UNKNOWN" });

    expect(toDocumentNfcError("weird").code).toBe("UNKNOWN");
  });

  it("status, cancel and progress go to the native module", async () => {
    const remove = vi.fn();
    native.current = fakeNative({
      getStatus: vi.fn().mockResolvedValue("disabled"),
      addListener: vi.fn().mockReturnValue({ remove })
    });

    await expect(getNfcStatus()).resolves.toBe("disabled");
    await cancelRead();
    expect(native.current.cancel).toHaveBeenCalled();

    const unsubscribe = addReadProgressListener(() => undefined);
    expect(native.current.addListener).toHaveBeenCalledWith("onProgress", expect.any(Function));
    unsubscribe();
    expect(remove).toHaveBeenCalled();
  });

  it("a failing status call means unavailable", async () => {
    native.current = fakeNative({ getStatus: vi.fn().mockRejectedValue(new Error("x")) });
    await expect(getNfcStatus()).resolves.toBe("unavailable");
  });
});
