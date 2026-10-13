import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmSheet, Sheet, Text } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("Sheet", () => {
  it("renders a titled dialog that closes from the ✕ and the veil", () => {
    const onClose = vi.fn();

    renderWithTheme(
      <Sheet onClose={onClose} testID="sheet" title="¿Qué buscas?" visible>
        <Text>Contenido</Text>
      </Sheet>
    );

    expect(screen.getByRole("dialog", { name: "¿Qué buscas?" })).toBeInTheDocument();
    expect(screen.getByText("Contenido")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("sheet-close"));
    fireEvent.click(screen.getByTestId("sheet-scrim"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders nothing while hidden", () => {
    renderWithTheme(
      <Sheet onClose={() => undefined} title="Oculta" visible={false}>
        <Text>Nada</Text>
      </Sheet>
    );

    expect(screen.queryByText("Nada")).not.toBeInTheDocument();
  });

  it("confirms, cancels and locks itself while loading", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { rerender } = renderWithTheme(
      <ConfirmSheet
        confirmLabel="Sí, borrar"
        destructive
        message="No se puede deshacer."
        onCancel={onCancel}
        onConfirm={onConfirm}
        testID="confirm"
        title="¿Borrar tu cuenta?"
        visible
      />
    );

    expect(screen.getByText("¿Borrar tu cuenta?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("confirm-confirm"));
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ConfirmSheet
        confirmLabel="Sí, borrar"
        destructive
        loading
        onCancel={onCancel}
        onConfirm={onConfirm}
        testID="confirm"
        title="¿Borrar tu cuenta?"
        visible
      />
    );

    expect(screen.getByTestId("confirm-cancel")).toBeDisabled();
    expect(screen.getByTestId("confirm-confirm")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("confirm-scrim")).toBeDisabled();
  });
});
