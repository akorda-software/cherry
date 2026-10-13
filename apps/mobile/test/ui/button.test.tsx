import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, Stack } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("Button", () => {
  it("presses with its label as accessible name and exposes the variant", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Stack>
        <Button icon="heart" onPress={onPress}>
          Empezar
        </Button>
        <Button label="Ahora no" onPress={onPress} variant="ghost" />
        <Button onPress={onPress} variant="ink">
          Tinta
        </Button>
      </Stack>
    );

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    expect(onPress).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Empezar" })).toHaveAttribute("data-variant", "primary");
    expect(screen.getByRole("button", { name: "Ahora no" })).toHaveAttribute("data-variant", "ghost");
    expect(screen.getByRole("button", { name: "Tinta" })).toHaveAttribute("data-variant", "ink");
  });

  it("blocks presses while loading without losing its name and announces busy", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Button loading onPress={onPress}>
        Guardar
      </Button>
    );

    const button = screen.getByRole("button", { name: "Guardar" });
    fireEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("progressbar", { name: "Cargando" })).toBeInTheDocument();
  });

  it("is disabled natively when disabled", () => {
    const onPress = vi.fn();

    renderWithTheme(
      <Button disabled onPress={onPress}>
        Continuar
      </Button>
    );

    const button = screen.getByRole("button", { name: "Continuar" });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(onPress).not.toHaveBeenCalled();
  });
});
