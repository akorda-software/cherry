import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProfileReport } from "@cherry/contracts";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import type { SafetyActionDeps } from "../application/safety-actions";
import { SafetySheet } from "./safety-sheet";

const report: ProfileReport = { id: "r1", reason: "spam", details: null, status: "open", insertedAt: "2026-09-29T10:00:00Z" };

function setup() {
  const deps: SafetyActionDeps = {
    block: vi.fn(async () => undefined),
    report: vi.fn(async () => report)
  };
  const onClose = vi.fn();
  const onBlocked = vi.fn();
  const onReported = vi.fn();
  renderWithTheme(
    <SafetySheet
      deps={deps}
      displayName="Lucía"
      onBlocked={onBlocked}
      onClose={onClose}
      onReported={onReported}
      profileId="p1"
      visible
    />
  );
  return { deps, onClose, onBlocked, onReported };
}

describe("SafetySheet", () => {
  it("offers reporting and blocking", () => {
    setup();

    expect(screen.getByText("Reportar a Lucía")).toBeInTheDocument();
    expect(screen.getByText("Bloquear a Lucía")).toBeInTheDocument();
  });

  it("reports with a reason and then offers to block too", async () => {
    const { deps, onReported, onBlocked, onClose } = setup();

    fireEvent.click(screen.getByTestId("safety-sheet-report"));
    expect(screen.getByTestId("safety-sheet-send-report")).toBeDisabled();

    fireEvent.click(screen.getByTestId("safety-sheet-reason-spam"));
    await act(async () => {
      fireEvent.click(screen.getByTestId("safety-sheet-send-report"));
    });

    expect(deps.report).toHaveBeenCalledWith("p1", { reason: "spam" });
    expect(onReported).toHaveBeenCalled();
    expect(screen.getByText("Gracias por contárnoslo")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("safety-sheet-block-too"));
    });

    expect(deps.block).toHaveBeenCalledWith("p1");
    expect(onClose).toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalled();
  });

  it("asks for a clear confirmation before blocking", async () => {
    const { deps, onBlocked } = setup();

    fireEvent.click(screen.getByTestId("safety-sheet-block"));
    expect(screen.getByText("¿Bloquear a Lucía?")).toBeInTheDocument();
    expect(screen.getByText("Lucía no recibirá ningún aviso.")).toBeInTheDocument();
    expect(deps.block).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("safety-sheet-confirm-block"));
    });

    expect(deps.block).toHaveBeenCalledWith("p1");
    expect(onBlocked).toHaveBeenCalled();
  });
});
