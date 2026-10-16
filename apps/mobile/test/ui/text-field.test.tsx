import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import * as Reanimated from "react-native-reanimated";

import { TextField } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("TextField", () => {
  it("labels the input, reports typing and counts characters", () => {
    const onChange = vi.fn();

    function Bio() {
      const [value, setValue] = useState("");
      return (
        <TextField
          hint="Entre 20 y 240 caracteres."
          label="Tu bio"
          maxLength={240}
          multiline
          onChangeText={(text) => {
            onChange(text);
            setValue(text);
          }}
          testID="bio"
          value={value}
        />
      );
    }

    renderWithTheme(<Bio />);

    expect(screen.getByText("Tu bio")).toBeInTheDocument();
    expect(screen.getByText("Entre 20 y 240 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("0/240")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("bio"), { target: { value: "Hola" } });

    expect(onChange).toHaveBeenCalledWith("Hola");
    expect(screen.getByText("4/240")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu bio")).toHaveValue("Hola");
  });

  it("replaces the hint with an announced error", () => {
    renderWithTheme(
      <TextField error="Ese correo no parece completo." hint="Te escribiremos aquí." label="Correo" value="hola@" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Ese correo no parece completo.");
    expect(screen.queryByText("Te escribiremos aquí.")).not.toBeInTheDocument();
  });

  it("renders the giant onboarding size with the display font", () => {
    renderWithTheme(<TextField label="¿Cómo te llamas?" size="xl" testID="name" value="Lucía" />);

    expect(screen.getByTestId("name")).toHaveStyle({ fontFamily: "Rubik-Black" });
  });

  it("does not re-render the focus decoration when only the text changes", () => {
    const animatedStyle = vi.spyOn(Reanimated, "useAnimatedStyle");
    const { rerender } = renderWithTheme(<TextField testID="description" value="Hola" />);
    animatedStyle.mockClear();

    rerender(<TextField testID="description" value="Hola de nuevo" />);

    // Only the error-shake wrapper is evaluated; the two focus worklets stay isolated.
    expect(animatedStyle).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("description")).toHaveValue("Hola de nuevo");
  });
});
