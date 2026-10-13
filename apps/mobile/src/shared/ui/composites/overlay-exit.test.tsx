import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithTheme } from "../../../../test/ui/render-with-theme";
import { Sheet } from "./sheet";
import { ToastHost, toast, useToastStore } from "./toast";

/** Simula salidas interrumpidas (un arrastre, otra animación): `finished === false`. */
const animation = vi.hoisted(() => ({ interrupted: false }));

vi.mock("react-native-reanimated", async () => {
  const actual = await import("../../../../test/mocks/react-native-reanimated");
  const withTiming = <T,>(value: T, _config?: unknown, callback?: (finished: boolean) => void) => {
    callback?.(!animation.interrupted);
    return value;
  };
  return { ...actual, default: actual.default, withTiming };
});

afterEach(() => {
  animation.interrupted = false;
  vi.useRealTimers();
  act(() => toast.clear());
});

describe("Sheet · cierre", () => {
  it("unmounts its modal even when the closing animation is interrupted", () => {
    const view = renderWithTheme(
      <Sheet onClose={() => undefined} testID="sheet" title="Hoja" visible>
        {null}
      </Sheet>
    );
    expect(screen.getByTestId("sheet")).toBeInTheDocument();

    animation.interrupted = true;
    view.rerender(
      <Sheet onClose={() => undefined} testID="sheet" title="Hoja" visible={false}>
        {null}
      </Sheet>
    );

    expect(screen.queryByTestId("sheet")).not.toBeInTheDocument();
  });
});

describe("Toast · relevo", () => {
  it("shows the next toast even when the exit animation is interrupted", () => {
    vi.useFakeTimers();
    renderWithTheme(<ToastHost />);

    act(() => {
      toast.show({ message: "Primero", duration: 1000 });
      toast.show({ message: "Segundo", duration: 1000 });
    });
    expect(screen.getByText("Primero")).toBeInTheDocument();

    animation.interrupted = true;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText("Segundo")).toBeInTheDocument();
    expect(useToastStore.getState().queue).toHaveLength(0);
  });

  it("advances only once per toast", () => {
    vi.useFakeTimers();
    renderWithTheme(<ToastHost />);

    act(() => {
      toast.show({ message: "Uno", duration: 1000 });
      toast.show({ message: "Dos", duration: 1000 });
      toast.show({ message: "Tres", duration: 1000 });
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    // El callback de la animación ya hizo el relevo; el respaldo no debe saltarse «Dos».
    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByText("Dos")).toBeInTheDocument();
  });
});
