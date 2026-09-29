import type { PropsWithChildren } from "react";
import Constants from "expo-constants";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { useToastStore } from "../../../shared/ui";
import { useSessionShell } from "../../auth/presentation";
import { FAREWELL_MESSAGE } from "../domain/delete-account";
import { HOLD_DURATION_MS } from "./hold-to-confirm-button";
import { SettingsScreen } from "./settings-screen";

function SignedInOnly({ children }: PropsWithChildren) {
  const { state } = useSessionShell();
  return state.status === "signed-in" ? <>{children}</> : null;
}

function renderSettings(logout = vi.fn(async () => undefined)) {
  renderRoute(
    <SignedInOnly>
      <SettingsScreen />
    </SignedInOnly>,
    {
      initialPath: "/(app)/settings",
      services: {
        bootstrapSession: { execute: async () => sessionFixture },
        logoutSession: { execute: logout }
      }
    }
  );

  return { logout };
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("groups account, visibility, privacy, about and the danger zone", async () => {
    const config = Constants.expoConfig as { version?: string };
    config.version = "1.2.3";
    stubBackend(() => ({ status: 404, body: {} }));
    renderSettings();

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cuenta" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pausar mi perfil" })).toBeInTheDocument();
    expect(screen.getByText("Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Zona de peligro" })).toBeInTheDocument();
    expect(screen.getByText("Snack · versión 1.2.3")).toBeInTheDocument();
    delete config.version;
  });

  it("signs out and goes back to the welcome screen", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    const { logout } = renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledWith(sessionFixture);
      expect(screen.getByTestId("pathname")).toHaveTextContent("/(public)/login");
    });
  });

  it("opens the manifesto", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Acerca de Snack" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/about");
  });

  it("explains what deleting does and lets you back out", async () => {
    const backend = stubBackend(() => ({ status: 404, body: {} }));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Borrar cuenta" }));

    expect(await screen.findByRole("heading", { name: "¿Borrar tu cuenta?" })).toBeInTheDocument();
    expect(screen.getByText("Cerramos tu sesión en todos tus dispositivos.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mejor no" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "¿Borrar tu cuenta?" })).not.toBeInTheDocument());
    expect(backend.callsTo("/api/me/account", "DELETE")).toHaveLength(0);
  });

  it("deletes the account after holding the button, clears the session and says goodbye", async () => {
    const backend = stubBackend(({ method, path }) =>
      method === "DELETE" && path === "/api/me/account" ? { body: { ok: true } } : { status: 404, body: {} }
    );
    const { logout } = renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Borrar cuenta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quiero borrarla" }));
    expect(await screen.findByRole("heading", { name: "Última confirmación" })).toBeInTheDocument();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = screen.getByRole("button", { name: "Borrar mi cuenta" });
    fireEvent.mouseDown(hold);
    expect(screen.getByText("Sigue pulsando…")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(HOLD_DURATION_MS);
    });

    await waitFor(() => {
      expect(backend.callsTo("/api/me/account", "DELETE")).toHaveLength(1);
      expect(logout).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("pathname")).toHaveTextContent("/(public)/login");
    });
    expect(useToastStore.getState().current?.message).toBe(FAREWELL_MESSAGE);
  });

  it("does nothing if you let go before it fills up", async () => {
    const backend = stubBackend(() => ({ body: { ok: true } }));
    renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Borrar cuenta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quiero borrarla" }));

    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hold = await screen.findByRole("button", { name: "Borrar mi cuenta" });
    fireEvent.mouseDown(hold);
    await act(async () => {
      vi.advanceTimersByTime(HOLD_DURATION_MS / 2);
    });
    fireEvent.mouseUp(hold);
    await act(async () => {
      vi.advanceTimersByTime(HOLD_DURATION_MS);
    });

    expect(backend.callsTo("/api/me/account", "DELETE")).toHaveLength(0);
    expect(screen.getByText("Mantén pulsado para borrar")).toBeInTheDocument();
  });

  it("stays on the sheet with a friendly error if the server cannot delete it", async () => {
    stubBackend(({ method, path }) =>
      method === "DELETE" && path === "/api/me/account" ? { status: 500, body: { error: "boom" } } : { status: 404, body: {} }
    );
    const { logout } = renderSettings();

    fireEvent.click(await screen.findByRole("button", { name: "Borrar cuenta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quiero borrarla" }));

    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.mouseDown(await screen.findByRole("button", { name: "Borrar mi cuenta" }));
    await act(async () => {
      vi.advanceTimersByTime(HOLD_DURATION_MS);
    });

    expect(
      await screen.findByText("Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar.")
    ).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/settings");
  });
});
