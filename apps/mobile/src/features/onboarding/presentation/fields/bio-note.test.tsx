import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { renderWithTheme } from "../../../../../test/ui/render-with-theme";
import { BioNote } from "./bio-note";

function Harness({ initial = "", error }: { initial?: string; error?: string }) {
  const [value, setValue] = useState(initial);
  return <BioNote error={error} onChange={setValue} testID="bio" value={value} />;
}

describe("BioNote", () => {
  it("counts live and marks the minimum once reached", () => {
    renderWithTheme(<Harness />);

    expect(screen.getByLabelText("Tu descripción")).toBeInTheDocument();
    expect(screen.getByTestId("bio-counter")).toHaveTextContent("0/240");
    expect(screen.getByTestId("bio-minimum")).toHaveTextContent("Mínimo 20");
    expect(screen.getByTestId("bio-minimum")).toHaveAttribute(
      "aria-label",
      "Faltan 20 caracteres para el mínimo de 20"
    );

    fireEvent.change(screen.getByTestId("bio-input"), { target: { value: "Me gusta subir al monte." } });

    expect(screen.getByTestId("bio-counter")).toHaveTextContent("24/240");
    expect(screen.getByTestId("bio-minimum")).toHaveAttribute("aria-label", "Mínimo de 20 caracteres cumplido");
  });

  it("keeps the ideas folded and appends one when tapped", () => {
    renderWithTheme(<Harness initial="Hola." />);

    expect(screen.queryByTestId("bio-ideas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("bio-ideas-toggle"));
    expect(screen.getByTestId("bio-ideas")).toHaveTextContent("Opcional.");

    fireEvent.click(screen.getByTestId("bio-starter-1"));
    expect(screen.getByTestId("bio-input")).toHaveValue("Hola.\nMe ganas si… ");
  });

  it("shows the save error below the field", () => {
    renderWithTheme(<Harness error="No hemos podido guardar." />);

    expect(screen.getByRole("alert")).toHaveTextContent("No hemos podido guardar.");
  });
});
