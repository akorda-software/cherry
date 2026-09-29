import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { toast, ToastHost, useToastStore } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("Toast", () => {
  afterEach(() => {
    act(() => toast.clear());
  });

  it("shows one sticker at a time and queues the rest", () => {
    renderWithTheme(<ToastHost />);

    act(() => {
      toast.show({ message: "¡Guardado!", tone: "success" });
      toast.show({ message: "Segundo aviso" });
    });

    expect(screen.getByRole("alert")).toHaveTextContent("¡Guardado!");
    expect(screen.queryByText("Segundo aviso")).not.toBeInTheDocument();
    expect(useToastStore.getState().queue).toHaveLength(1);

    act(() => useToastStore.getState().next());
    expect(screen.getByRole("alert")).toHaveTextContent("Segundo aviso");
  });

  it("dismisses on tap", () => {
    renderWithTheme(<ToastHost />);

    act(() => toast.show({ message: "Tócame" }));
    act(() => {
      fireEvent.click(screen.getByTestId("toast"));
    });

    expect(screen.queryByText("Tócame")).not.toBeInTheDocument();
  });
});
