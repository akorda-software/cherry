import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupportCase } from "@cherry/contracts";
import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { useSessionStore } from "../../auth/presentation";
import { SupportScreen } from "./support-screen";

const record: SupportCase = {
  id: "case-1",
  kind: "report",
  category: "harassment",
  status: "resolved",
  statement: null,
  response: "Motivo de la decisión sin datos de otras personas.",
  outcome: "warning",
  insertedAt: "2026-10-16T10:00:00Z",
  resolvedAt: "2026-10-16T11:00:00Z",
  canAppeal: true
};

function renderInbox() {
  return renderRoute(<SupportScreen />, {
    initialPath: "/(app)/support",
    services: { bootstrapSession: { execute: async () => sessionFixture } }
  });
}

describe("SupportScreen", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows empty only after the first load resolves", async () => {
    let finish!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
    );
    renderInbox();
    await screen.findByRole("button", { name: "Nueva reclamación" });
    expect(screen.queryByText(/Aún no tienes expedientes/)).not.toBeInTheDocument();
    await act(async () => finish(new Response(JSON.stringify({ cases: [] }), { status: 200 })));
    expect(await screen.findByText(/Aún no tienes expedientes/)).toBeInTheDocument();
  });

  it("keeps a failed draft and submits a privacy request on retry", async () => {
    let failed = true;
    const cases: SupportCase[] = [];
    const backend = stubBackend(({ method, path, body }) => {
      if (method === "GET") return { body: { cases } };
      if (path === "/api/me/cases") {
        if (failed) return { status: 503, body: { error: "unavailable" } };
        const input = body as { kind: "privacy"; category: string; statement: string };
        const created = {
          ...record,
          ...input,
          id: "privacy-1",
          status: "open" as const,
          response: null,
          outcome: null,
          resolvedAt: null,
          canAppeal: false
        };
        cases.push(created);
        return { status: 201, body: { case: created } };
      }
      return { status: 404 };
    });
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Ejercer mis derechos de privacidad" }));
    fireEvent.click(screen.getByRole("button", { name: "Solicitar supresión" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Cuéntanos qué necesitas" }), {
      target: { value: "Quiero solicitar la supresión de mis datos." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Quiero solicitar la supresión de mis datos.");
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText(/Solicitud recibida/)).toBeInTheDocument();
    expect(backend.callsTo("/api/me/cases", "POST")).toHaveLength(2);
    expect(backend.callsTo("/api/me/cases", "POST")[1]?.body).toEqual({
      kind: "privacy",
      category: "erasure",
      statement: "Quiero solicitar la supresión de mis datos."
    });
  });

  it("opens the private response and files a human appeal", async () => {
    const cases = [record];
    const backend = stubBackend(({ method, path }) => {
      if (method === "GET" && path === "/api/me/cases/case-1") return { body: { case: record } };
      if (method === "GET") return { body: { cases } };
      const appeal = {
        ...record,
        id: "appeal-1",
        kind: "appeal" as const,
        status: "open" as const,
        response: null,
        canAppeal: false
      };
      cases.push(appeal);
      return { status: 201, body: { case: appeal } };
    });
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir expediente case-1" }));
    expect(screen.getByText(record.response!)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Pedir revisión humana" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Pedir revisión humana" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Solicito que otra persona revise la decisión." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar solicitud" }));
    expect(await screen.findByText(/Solicitud recibida/)).toBeInTheDocument();
    expect(backend.callsTo("/api/me/cases/case-1/appeal", "POST")[0]?.body).toEqual({
      statement: "Solicito que otra persona revise la decisión."
    });
  });

  it("shows a minimal account measure and keeps its human-review action available", async () => {
    const measure: SupportCase = {
      ...record,
      kind: "measure",
      category: "safety",
      outcome: "suspend",
      response: "Ficha mínima de tu suspensión, sin datos de otras personas."
    };
    stubBackend(({ path }) =>
      path === "/api/me/cases/case-1" ? { body: { case: measure } } : { body: { cases: [measure] } }
    );
    renderInbox();
    expect(await screen.findByText(/Medida sobre tu cuenta/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir expediente case-1" }));
    expect(await screen.findByText(measure.response!)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Pedir revisión humana" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "Pedir revisión humana" }));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows an initial failure with retry, not an empty inbox", async () => {
    let fail = true;
    stubBackend(() => (fail ? { status: 500 } : { body: { cases: [] } }));
    renderInbox();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Aún no tienes expedientes/)).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    expect(await screen.findByText(/Aún no tienes expedientes/)).toBeInTheDocument();
  });

  it("clears drafts and late private responses when the account changes", async () => {
    let finish!: (value: Response) => void;
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        ++calls === 1
          ? new Promise<Response>((resolve) => {
              finish = resolve;
            })
          : Promise.resolve(new Response(JSON.stringify({ cases: [] }), { status: 200 }))
      )
    );
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Nueva reclamación" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "BORRADOR_PRIVADO_CUENTA_1" } });
    act(() =>
      useSessionStore.setState({
        status: "signed-in",
        session: { ...sessionFixture, user: { ...sessionFixture.user, id: "another-user" } }
      })
    );
    await screen.findByRole("button", { name: "Nueva reclamación" });
    await act(async () =>
      finish(
        new Response(JSON.stringify({ cases: [{ ...record, response: "RESPUESTA_PRIVADA_CUENTA_1" }] }), {
          status: 200
        })
      )
    );
    expect(screen.queryByText("RESPUESTA_PRIVADA_CUENTA_1")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nueva reclamación" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("refreshes the selected detail independently of a stale list and hides an already filed appeal", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/cases/case-1"
        ? { body: { case: { ...record, response: "Respuesta actualizada del servidor.", canAppeal: false } } }
        : { body: { cases: [record] } }
    );
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir expediente case-1" }));
    expect(await screen.findByText("Respuesta actualizada del servidor.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir revisión humana" })).not.toBeInTheDocument();
  });

  it("keeps a detail refresh failure visible and prevents appealing stale data until retry", async () => {
    let fail = true;
    stubBackend(({ path }) =>
      path === "/api/me/cases/case-1"
        ? fail
          ? { status: 503 }
          : { body: { case: record } }
        : { body: { cases: [record] } }
    );
    renderInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir expediente case-1" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(record.response!)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pedir revisión humana" })).not.toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Actualizar expediente" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pedir revisión humana" })).not.toBeDisabled());
  });
});
