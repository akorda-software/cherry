import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Platform } from "react-native";
import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { useSessionStore } from "../../auth/presentation";
import { AuthMethodsScreen } from "./auth-methods-screen";

const one = { methods: [{ provider: "google", canUnlink: false }] };
const both = { methods: [{ provider: "google", canUnlink: true }, { provider: "apple", canUnlink: true }] };
const platform = Platform as { OS: string };
const originalOS = platform.OS;
function renderMethods() {
  return renderRoute(<AuthMethodsScreen />, { initialPath: "/(app)/auth-methods",
    services: { bootstrapSession: { execute: async () => sessionFixture } } });
}

describe("AuthMethodsScreen", () => {
  beforeEach(() => { platform.OS = "ios"; });
  afterEach(() => { platform.OS = originalOS; vi.unstubAllGlobals(); });
  it("shows linked methods, disables removing the last, then links using proofs without changing the session", async () => {
    const backend = stubBackend(({ method }) => ({ body: method === "GET" ? one : both }));
    renderMethods();
    expect(await screen.findByRole("button", { name: "Quitar Google" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Vincular Apple" }));
    expect(screen.getByText(/Primero confirma tu acceso con Google y después con Apple/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar con Google" }));
    expect(await screen.findByText(/Apple ya está vinculado/)).toBeInTheDocument();
    const request = backend.callsTo("/api/me/auth-methods/apple", "POST")[0];
    expect(request?.body).toMatchObject({ currentProvider: "google", currentCredential: { providerToken: "google-token" }, credential: { providerToken: "apple-token" } });
    expect(request?.body).not.toHaveProperty("device");
    expect(useSessionStore.getState().session).toBe(sessionFixture);
    expect(screen.getByRole("button", { name: "Quitar Google" })).toBeEnabled();
  });
  it("failed load is not an empty list and retry recovers", async () => {
    let fail = true;
    stubBackend(() => fail ? { status: 503 } : { body: one });
    renderMethods();
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.queryByText(/No hay métodos vinculados/)).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Vincular Apple" })).toBeInTheDocument();
  });
  it("a failed mutation preserves the confirmation and retry succeeds without losing methods", async () => {
    let fail = true;
    const backend = stubBackend(({ method }) => method === "GET" ? { body: one } : fail
      ? { status: 409, body: { error: "identity_in_use" } } : { body: both });
    renderMethods();
    fireEvent.click(await screen.findByRole("button", { name: "Vincular Apple" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar con Google" }));
    expect(await screen.findByText(/Ese acceso pertenece a otra cuenta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar con Google" })).toBeEnabled();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Confirmar con Google" }));
    expect(await screen.findByText(/Apple ya está vinculado/)).toBeInTheDocument();
    expect(backend.callsTo("/api/me/auth-methods/apple", "POST")).toHaveLength(2);
  });
  it("requires confirmation with the remaining provider before unlink and updates the last-method guard", async () => {
    const backend = stubBackend(({ method }) => ({ body: method === "GET" ? both : one }));
    renderMethods();
    fireEvent.click(await screen.findByRole("button", { name: "Quitar Apple" }));
    expect(screen.getByText(/Confirma tu identidad con Google/)).toBeInTheDocument();
    expect(backend.callsTo("/api/me/auth-methods/apple/unlink", "POST")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar con Google" }));
    expect(await screen.findByText(/Apple se ha retirado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar Google" })).toBeDisabled();
  });
  it("cancelling confirmation never calls a mutation", async () => {
    const backend = stubBackend(() => ({ body: one }));
    renderMethods();
    fireEvent.click(await screen.findByRole("button", { name: "Vincular Apple" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar con Google" })).not.toBeInTheDocument());
    expect(backend.calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });
});
