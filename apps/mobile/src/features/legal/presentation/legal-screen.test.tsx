import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import type { LegalPublication } from "../domain/legal";
import { LegalScreen } from "./legal-screen";
import { useSessionStore } from "../../auth/presentation";

const api = vi.hoisted(() => ({ get: vi.fn(), accept: vi.fn() }));
vi.mock("../infrastructure/legal-api", () => ({ createLegalApi: () => api }));

const publication: LegalPublication = {
  version: "test-version", fingerprint: "test-digest", ready: true,
  termsText: "Acepto solo condiciones y normas.",
  adulthoodText: "Confirmo mayoría de edad.",
  sensitiveText: "Consiento explícitamente la finalidad sensible especificada.",
  documents: [{ slug: "privacidad", title: "Política de privacidad", intro: "Esta versión exacta", sections: [["Una finalidad", "Un texto completo."]] }]
};
const signedIn = { services: { bootstrapSession: { execute: async () => sessionFixture } } };
function data(ready = true, accepted = false) {
  return { publication: { ...publication, ready }, status: { required: true, accepted, ready, version: publication.version, fingerprint: publication.fingerprint } };
}

describe("legal screen", () => {
  beforeEach(() => {
    useSessionStore.setState({ status: "loading", session: null, error: null, busyProvider: null });
    api.get.mockReset().mockResolvedValue(data());
    api.accept.mockReset().mockResolvedValue({ accepted: true });
  });

  it("shows exact texts, never prechecks consent, preserves choices after failure and saves on retry", async () => {
    api.accept.mockRejectedValueOnce(new Error("offline"));
    renderRoute(<LegalScreen />, signedIn);
    const save = await screen.findByTestId("legal-accept");
    expect(save).toBeDisabled();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    for (const checkbox of checkboxes) { expect(checkbox).not.toBeChecked(); fireEvent.click(checkbox); }
    fireEvent.click(screen.getByRole("button", { name: "Política de privacidad" }));
    expect(screen.getByText("Un texto completo.")).toBeInTheDocument();
    fireEvent.click(save);
    expect(await screen.findByText(/No hemos podido guardar/)).toBeInTheDocument();
    for (const checkbox of checkboxes) expect(checkbox).toBeChecked();
    fireEvent.click(save);
    expect(await screen.findByText(/ya tiene registrada/)).toBeInTheDocument();
    expect(api.accept).toHaveBeenLastCalledWith(publication, { termsAccepted: true, adulthoodConfirmed: true, sensitiveConsent: true });
    expect(api.accept).toHaveBeenCalledTimes(2);
  });

  it("unapproved or empty documents cannot be accepted, but rights and deletion remain reachable", async () => {
    api.get.mockResolvedValue({ ...data(false), publication: { ...publication, ready: false, documents: [] } });
    renderRoute(<LegalScreen gate />, signedIn);
    expect(await screen.findByText(/Textos preparatorios/)).toBeInTheDocument();
    expect(screen.getByText(/publicación vacía/)).toBeInTheDocument();
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    expect(screen.getByTestId("legal-accept")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retirar y borrar mi cuenta" }));
    expect(await screen.findByRole("heading", { name: "¿Borrar tu cuenta?" })).toBeInTheDocument();
    expect(api.accept).not.toHaveBeenCalled();
  });

  it("fetch failure does not block rights or leave a fake acceptance; retry recovers", async () => {
    api.get.mockRejectedValueOnce(new Error("offline"));
    renderRoute(<LegalScreen gate />, signedIn);
    expect(await screen.findByText(/No hemos podido cargar los textos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buzón y derechos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salir sin aceptar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByTestId("legal-accept")).toBeDisabled();
  });

  it("policy conflict keeps decisions, requires reload and resets all boxes on the new publication", async () => {
    api.accept.mockRejectedValueOnce(Object.assign(new Error("policy_changed"), { code: "policy_changed" }));
    renderRoute(<LegalScreen />, signedIn);
    await screen.findByTestId("legal-accept");
    for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
    fireEvent.click(screen.getByTestId("legal-accept"));
    expect(await screen.findByText(/Los textos han cambiado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recargar textos" }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("legal-accept")).toBeDisabled();
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).not.toBeChecked();
  });
});
