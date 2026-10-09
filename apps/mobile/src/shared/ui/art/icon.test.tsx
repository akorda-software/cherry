import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { lightTheme } from "../themes/light-theme";
import { Icon, iconNames, opticalStrokeWidth } from "./icon";
import { iconPaths } from "./icon-paths";
import { PaperBackground } from "./paper-background";

describe("Icon", () => {
  it("renders every icon of the set without crashing", () => {
    for (const name of iconNames) {
      const { container, unmount } = render(<Icon name={name} size={24} />);
      expect(container.querySelectorAll("path").length).toBe(iconPaths[name].length);
      unmount();
    }
  });

  it("covers the minimum set the screens rely on", () => {
    const required = [
      "heart", "heart-filled", "x", "undo", "star", "sparkle", "sparkles", "chat", "chat-dots", "user", "users",
      "cards", "feed", "sliders", "gear", "camera", "image", "plus", "minus", "trash", "pencil", "flag", "block",
      "pause", "play", "pin", "check", "check-circle", "chevron-left", "chevron-right", "chevron-down", "close",
      "send", "info", "lock", "eye", "eye-off", "logout", "shield", "bell", "more", "refresh", "search", "arrow-up",
      "gift", "code", "cake", "mail", "leaf", "flower", "tag"
    ];
    for (const name of required) {
      expect(iconNames).toContain(name);
    }
  });

  it("is decorative by default and an image when labelled", () => {
    const { container, rerender, getByRole } = render(<Icon name="heart" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");

    rerender(<Icon name="heart" accessibilityLabel="Me gusta" />);
    expect(getByRole("img").getAttribute("aria-label")).toBe("Me gusta");
  });

  it("uses ink by default, pastel fill on closed shapes and solid fill for -filled icons", () => {
    const ink = lightTheme.semantic.icon.default;
    const { container, rerender } = render(<Icon name="heart" />);
    const path = () => container.querySelector("path");
    expect(path()?.getAttribute("stroke")).toBe(ink);
    expect(path()?.getAttribute("fill")).toBe("none");

    rerender(<Icon name="heart" fill={lightTheme.primitives.color.fresa} />);
    expect(path()?.getAttribute("fill")).toBe(lightTheme.primitives.color.fresa);

    rerender(<Icon name="heart-filled" color="#000000" />);
    expect(path()?.getAttribute("fill")).toBe("#000000");
  });

  it("keeps an optical stroke between 1.6 and 3.6 px", () => {
    expect(opticalStrokeWidth(24)).toBe(2.25);
    expect((opticalStrokeWidth(16) * 16) / 24).toBeCloseTo(1.6, 2);
    expect((opticalStrokeWidth(48) * 48) / 24).toBeCloseTo(3.6, 2);
  });
});

describe("PaperBackground", () => {
  it("renders a dotted pattern that never captures touches", () => {
    const { container } = render(<PaperBackground testID="paper" />);
    const root = container.querySelector("[data-testid=paper]") as HTMLElement;
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.backgroundColor).not.toBe("");
    // En web (entorno de test) la trama es un <Pattern> SVG; en iOS/Android, una baldosa PNG repetida.
    expect(container.querySelector("pattern")).not.toBeNull();
  });

  it("tints the paper with a pastel and can drop the dots", () => {
    const { container } = render(<PaperBackground testID="paper" tone="menta" dotted={false} />);
    const root = container.querySelector("[data-testid=paper]") as HTMLElement;
    expect(container.querySelector("pattern")).toBeNull();
    expect(root.style.backgroundColor).toBe("rgb(217, 246, 227)");
  });
});
