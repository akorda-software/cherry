import type { PropsWithChildren } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import type { DocumentNfcNativeModule } from "../../../../modules/document-nfc/src/native";
import { useSessionShell } from "../../auth/presentation";
import { DocumentVerificationScreen } from "./document-verification-screen";

const native = vi.hoisted(() => ({ current: null as DocumentNfcNativeModule | null }));

vi.mock("../../../../modules/document-nfc/src/native", () => ({ loadNativeModule: () => native.current }));

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

function SignedInOnly({ children }: PropsWithChildren) {
  const { state } = useSessionShell();
  return state.status === "signed-in" ? <>{children}</> : null;
}

function renderScreen() {
  renderRoute(
    <SignedInOnly>
      <DocumentVerificationScreen />
    </SignedInOnly>,
    { initialPath: "/verify-document", services: { bootstrapSession: { execute: async () => sessionFixture } } }
  );
}

async function enterCan(can: string) {
  fireEvent.click(await screen.findByTestId("verify-start"));
  fireEvent.change(await screen.findByTestId("verify-can"), { target: { value: can } });
}

/** Continuar desde la clave y empezar a leer desde la guía de colocación. */
async function readNow() {
  fireEvent.click(screen.getByTestId("verify-read"));
  fireEvent.click(await screen.findByTestId("verify-begin-read"));
}

describe("DocumentVerificationScreen", () => {
  beforeEach(() => {
    native.current = fakeNative();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains what is read, kept and deleted, then verifies with the CAN", async () => {
    const backend = stubBackend(({ path }) =>
      path === "/api/me/verification/nfc"
        ? { body: { verification: { status: "verified", method: "nfc_dni", verifiedAt: "2026-10-09T12:00:00Z" }, required: false } }
        : { status: 404, body: {} }
    );
    renderScreen();

    expect(await screen.findByText("Qué se lee")).toBeInTheDocument();
    expect(screen.getByText("Qué se guarda")).toBeInTheDocument();
    expect(screen.getByText("Qué se borra")).toBeInTheDocument();

    await enterCan("12a3456");
    expect(screen.getByTestId("verify-can")).toHaveValue("123456");
    expect(screen.getByTestId("can-location-art")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("verify-read"));

    // Antes de leer, cómo colocarlo.
    expect(await screen.findByTestId("nfc-placement-art")).toBeInTheDocument();
    expect(screen.getByTestId("verify-guide-steps")).toHaveTextContent("a la altura de la cámara");
    expect(native.current?.read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("verify-begin-read"));

    expect(await screen.findByTestId("verify-success")).toHaveTextContent("Listo: tu perfil ya está activo");
    expect(native.current?.read).toHaveBeenCalledWith({ can: "123456" }, expect.objectContaining({ timeoutMs: 90_000 }));
    // Only the chip files reach the server: never the CAN.
    expect(backend.callsTo("/api/me/verification/nfc", "POST")[0]?.body).toEqual({ dg1: "ZGcx", sod: "c29k" });
  });

  it("the read button waits for six digits", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderScreen();
    await enterCan("12345");

    expect(screen.getByTestId("verify-read")).toBeDisabled();
  });

  it("shows server errors with the technical detail in development", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/verification/nfc"
        ? { status: 422, body: { error: "document_not_verified", reason: "untrusted_certificate" } }
        : { status: 404, body: {} }
    );
    renderScreen();
    await enterCan("123456");
    await readNow();

    expect(await screen.findByTestId("verify-error-title")).toHaveTextContent("No hemos podido comprobar el documento");
    expect(screen.getByTestId("verify-error-detail")).toHaveTextContent("untrusted_certificate");
    expect(screen.getByTestId("verify-retry")).toBeInTheDocument();
  });

  it("a minor's account is gone: the only way out is signing out", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/verification/nfc"
        ? { status: 422, body: { error: "underage", accountDeleted: true } }
        : { status: 404, body: {} }
    );
    renderScreen();
    await enterCan("123456");
    await readNow();

    expect(await screen.findByTestId("verify-error-title")).toHaveTextContent("Cherry es para mayores de edad");
    expect(screen.getByTestId("verify-sign-out")).toBeInTheDocument();
    expect(screen.queryByTestId("verify-retry")).not.toBeInTheDocument();
  });

  it("a wrong CAN offers to change it", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    native.current = fakeNative({ read: vi.fn().mockRejectedValue(Object.assign(new Error("PACE failed"), { code: "ACCESS_DENIED" })) });
    renderScreen();
    await enterCan("654321");
    await readNow();

    expect(await screen.findByTestId("verify-error-title")).toHaveTextContent("El CAN no coincide");
    fireEvent.click(screen.getByTestId("verify-edit-key"));
    expect(await screen.findByTestId("verify-can")).toBeInTheDocument();
  });

  it("without NFC it says so before asking for anything", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    native.current = null;
    renderScreen();
    fireEvent.click(await screen.findByTestId("verify-start"));

    expect(await screen.findByTestId("verify-error-title")).toHaveTextContent("Este móvil no puede leer el chip");
    expect(screen.queryByTestId("verify-retry")).not.toBeInTheDocument();
  });

  it("a card whose chip refuses the CAN can be read with its MRZ data", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/verification/nfc"
        ? { body: { verification: { status: "verified", method: "nfc_dni", verifiedAt: "2026-10-09T12:00:00Z" }, required: false } }
        : { status: 404, body: {} }
    );
    native.current = fakeNative({
      read: vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("PACE failed"), { code: "ACCESS_DENIED" }))
        .mockResolvedValue({ dg1: "ZGcx", sod: "c29k" })
    });
    renderScreen();
    await enterCan("123456");
    await readNow();

    expect(await screen.findByTestId("verify-error-title")).toHaveTextContent("El CAN no coincide");
    expect(screen.getByTestId("verify-edit-key")).toHaveTextContent("Cambiar el CAN");
    fireEvent.click(screen.getByTestId("verify-use-mrz"));

    expect(await screen.findByText("Datos del documento")).toBeInTheDocument();
    expect(screen.getByTestId("verify-switch-access")).toHaveTextContent("Usar el CAN");
    fireEvent.change(screen.getByTestId("verify-passport-number"), { target: { value: "ab 12345 6" } });
    fireEvent.change(screen.getByTestId("verify-passport-birth"), { target: { value: "17/05/1990" } });
    fireEvent.change(screen.getByTestId("verify-passport-expiry"), { target: { value: "17/05/2031" } });
    await readNow();

    await waitFor(() =>
      expect(native.current?.read).toHaveBeenLastCalledWith(
        { documentNumber: "AB123456", dateOfBirth: "900517", dateOfExpiry: "310517" },
        expect.anything()
      )
    );
    expect(await screen.findByTestId("verify-success")).toBeInTheDocument();
  });

  it("from the CAN step a card without CAN is one tap away", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderScreen();
    fireEvent.click(await screen.findByTestId("verify-start"));

    fireEvent.click(await screen.findByTestId("verify-switch-access"));
    expect(screen.getByText("Datos del documento")).toBeInTheDocument();
    expect(screen.getByTestId("verify-switch-kind")).toHaveTextContent("Tengo pasaporte");

    fireEvent.click(screen.getByTestId("verify-switch-kind"));
    expect(screen.getByText("Datos del pasaporte")).toBeInTheDocument();
    expect(screen.queryByTestId("verify-switch-access")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("verify-switch-kind"));
    expect(screen.getByTestId("verify-can")).toBeInTheDocument();
  });

  it("passports use the MRZ data", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/verification/nfc"
        ? { body: { verification: { status: "verified", method: "nfc_passport", verifiedAt: "2026-10-09T12:00:00Z" }, required: false } }
        : { status: 404, body: {} }
    );
    renderScreen();
    fireEvent.click(await screen.findByTestId("verify-start"));
    fireEvent.click(await screen.findByTestId("verify-switch-kind"));

    fireEvent.change(screen.getByTestId("verify-passport-number"), { target: { value: "zz1234567" } });
    fireEvent.change(screen.getByTestId("verify-passport-birth"), { target: { value: "17/05/1990" } });
    expect(screen.getByTestId("verify-read")).toBeDisabled();
    fireEvent.change(screen.getByTestId("verify-passport-expiry"), { target: { value: "17/05/2031" } });
    await readNow();

    await waitFor(() =>
      expect(native.current?.read).toHaveBeenCalledWith(
        { documentNumber: "ZZ1234567", dateOfBirth: "900517", dateOfExpiry: "310517" },
        expect.anything()
      )
    );
    expect(await screen.findByTestId("verify-success")).toBeInTheDocument();
  });
});
