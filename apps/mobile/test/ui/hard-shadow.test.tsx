import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HardShadow, Pill, splitShadowStyle, Surface, Text } from "../../src/shared/ui";
import { renderWithTheme } from "./render-with-theme";

describe("HardShadow", () => {
  it("splits layout (outer box) from look (face) and copies the face radii to the shadow", () => {
    const { outer, face, radii, sized } = splitShadowStyle([
      { margin: 4, width: 120, alignSelf: "center", transform: [{ rotate: "2deg" }], opacity: 0.5 },
      [{ backgroundColor: "#fff", borderWidth: 3, padding: 10, overflow: "hidden" }, { borderTopLeftRadius: 18, borderRadius: 6 }]
    ]);

    expect(outer).toEqual({ margin: 4, width: 120, alignSelf: "center", transform: [{ rotate: "2deg" }], opacity: 0.5 });
    expect(face).toEqual({ backgroundColor: "#fff", borderWidth: 3, padding: 10, overflow: "hidden", borderTopLeftRadius: 18, borderRadius: 6 });
    expect(radii).toEqual({ borderTopLeftRadius: 18, borderRadius: 6 });
    expect(sized).toBe(false);
    expect(splitShadowStyle({ height: 40 }).sized).toBe(true);
    expect(splitShadowStyle({ flex: 1 }).sized).toBe(true);
    expect(splitShadowStyle({ position: "absolute", top: 0, bottom: 0 }).sized).toBe(true);
  });

  it("paints the shadow as an offset sibling view behind the face, never with boxShadow", () => {
    renderWithTheme(
      <HardShadow elevation="lg" style={{ borderRadius: 16, backgroundColor: "#fff", marginTop: 8 }} testID="piece">
        <Text>Cara</Text>
      </HardShadow>
    );

    const outer = screen.getByTestId("piece");
    const [shadow, face] = Array.from(outer.children) as HTMLElement[];

    expect(outer.style.marginTop).toBe("8px");
    expect(shadow.style.position).toBe("absolute");
    expect(shadow.style.top).toBe("6px");
    expect(shadow.style.left).toBe("6px");
    expect(shadow.style.right).toBe("-6px");
    expect(shadow.style.bottom).toBe("-6px");
    expect(shadow.style.borderRadius).toBe("16px");
    expect(face.style.backgroundColor).not.toBe("");
    expect(face).toHaveTextContent("Cara");
    expect(document.body.innerHTML).not.toContain("box-shadow");
  });

  it("keeps the structure without a shadow view for `none`", () => {
    renderWithTheme(
      <HardShadow elevation="none" testID="flat">
        <Text>Plana</Text>
      </HardShadow>
    );

    expect(screen.getByTestId("flat").children).toHaveLength(1);
  });

  it("design-system pieces no longer use boxShadow", () => {
    renderWithTheme(
      <>
        <Surface>
          <Text>Tarjeta</Text>
        </Surface>
        <Pill label="Nuevo" />
      </>
    );

    expect(document.body.innerHTML).not.toContain("box-shadow");
  });
});
