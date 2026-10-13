import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { lightTheme } from "../themes/light-theme";
import { mixHex, svgSafeId, withAlpha } from "./color-utils";
import { Deco, decoKinds, Sparkle } from "./deco";
import { Confetti, createBurstParticles, HeartBurst, type HeartBurstHandle, MAX_BURST_PARTICLES } from "./heart-burst";
import { Logo } from "./logo";
import { Mascot, mascotMoods } from "./mascot";
import { PolaroidFrame } from "./polaroid-frame";
import { Stamp } from "./stamp";
import { Sticker } from "./sticker";
import { StickyNote, stickyNotePaths } from "./sticky-note";
import { WashiTape, washiPath, washiPatterns } from "./washi-tape";

describe("Mascot (Mochi)", () => {
  it("renders every mood, animated and static", () => {
    for (const mood of mascotMoods) {
      for (const animated of [true, false]) {
        const { container, unmount } = render(<Mascot mood={mood} animated={animated} size={96} />);
        expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
        unmount();
      }
    }
  });

  it("is decorative unless labelled", () => {
    const { container, rerender, getByRole } = render(<Mascot />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    rerender(<Mascot accessibilityLabel="Mochi durmiendo" mood="sleepy" />);
    expect(getByRole("img").getAttribute("aria-label")).toBe("Mochi durmiendo");
  });

  it("paints the body with the chosen pastel", () => {
    const { container } = render(<Mascot color="menta" animated={false} />);
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills).toContain(lightTheme.primitives.color.menta);
  });
});

describe("Logo", () => {
  it("is an image named Cherry and keeps its aspect ratio", () => {
    const { getByRole } = render(<Logo height={40} />);
    const logo = getByRole("img");
    expect(logo.getAttribute("aria-label")).toBe("Cherry");
    expect(Number.parseFloat(logo.style.width)).toBeGreaterThan(70);
    expect(logo.style.height).toBe("40px");
  });

  it("supports the plain variant and pastel letters", () => {
    // Letras, rabitos, hoja, cerezas y brillos; sin capas de pegatina.
    const plain = render(<Logo variant="plain" />);
    expect(plain.container.querySelectorAll("path").length).toBe(5);
    plain.unmount();
    const filled = render(<Logo fill="fresa" />);
    const fills = Array.from(filled.container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills).toContain(lightTheme.primitives.color.fresa);
    // Las cerezas no se confunden con unas letras fresa.
    expect(fills).toContain(lightTheme.primitives.pastel.tomate.fill);
  });

  it("the two r's end in cherries", () => {
    const { container } = render(<Logo />);
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    expect(fills).toContain(lightTheme.primitives.pastel.fresa.fill);
    expect(fills).toContain(lightTheme.primitives.pastel.menta.fill);
  });
});

describe("WashiTape", () => {
  it("renders every pattern", () => {
    for (const pattern of washiPatterns) {
      const { container, unmount } = render(<WashiTape pattern={pattern} color="menta" rotation={-30} />);
      expect(container.querySelector("path")).not.toBeNull();
      expect(Boolean(container.querySelector("pattern"))).toBe(pattern !== "plain");
      unmount();
    }
  });

  it("cuts both ends in a zigzag inside the requested box", () => {
    const d = washiPath(100, 24);
    const points = Array.from(d.matchAll(/L(-?[\d.]+) (-?[\d.]+)/g)).map((m) => [Number(m[1]), Number(m[2])]);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    // Dientes hacia fuera en x = 0 y x = 100; entrantes a 3.5 del borde.
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(100);
    expect(xs.filter((x) => x === 100)).toHaveLength(4);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(24);
    expect(d.startsWith("M3.5 0H96.5")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });
});

describe("Stamp", () => {
  it("shows the label in the stamp ink colour", () => {
    const { getByText } = render(<Stamp label="¡Me gusta!" tone="fresa" />);
    const text = getByText("¡Me gusta!");
    expect(text.style.textTransform).toBe("uppercase");
    expect(text.style.color).toBe("rgb(189, 36, 15)");
  });

  it("supports circle stamps with ornaments and slam-in", () => {
    const { container, getByText } = render(<Stamp label="¡Match!" shape="circle" slam size="lg" />);
    expect(getByText("¡Match!")).toBeInTheDocument();
    expect(container.querySelectorAll("svg").length).toBe(2);
  });
});

describe("StickyNote, Sticker, Deco", () => {
  it("renders the note content and computes the folded corner", () => {
    const { getByText } = render(
      <StickyNote color="menta" tilt={3}>
        <Text>Sin dramas</Text>
      </StickyNote>
    );
    expect(getByText("Sin dramas")).toBeInTheDocument();

    const folded = stickyNotePaths(160, 120, true);
    expect(folded.flap).not.toBeNull();
    expect(folded.body).toContain("L138 120");
    expect(stickyNotePaths(160, 120, false).flap).toBeNull();
  });

  it("wraps any content as a sticker", () => {
    const { getByText } = render(
      <Sticker color="limonada" shape="pill" rotation={-4} pop>
        <Text>En común</Text>
      </Sticker>
    );
    expect(getByText("En común")).toBeInTheDocument();
  });

  it("draws every decoration kind and the sparkle shortcut", () => {
    for (const kind of decoKinds) {
      const { container, unmount } = render(<Deco kind={kind} color="lavanda" rotation={12} />);
      expect(container.querySelector("svg")).not.toBeNull();
      unmount();
    }
    const { container } = render(<Sparkle size={18} />);
    expect(container.querySelector("path")).not.toBeNull();
  });
});

describe("PolaroidFrame", () => {
  it("shows the photo through expo-image and the handwritten caption", () => {
    const { getByTestId, getByText } = render(<PolaroidFrame uri="https://example.com/a.jpg" caption="¡hola!" width={200} />);
    expect(getByTestId("expo-image").textContent).toBe("https://example.com/a.jpg");
    expect(getByText("¡hola!")).toBeInTheDocument();
  });

  it("falls back to a placeholder and accepts children", () => {
    const empty = render(<PolaroidFrame tapes="none" />);
    expect(empty.container.querySelector("svg")).not.toBeNull();
    empty.unmount();
    const custom = render(
      <PolaroidFrame tapes="top">
        <Text>foto</Text>
      </PolaroidFrame>
    );
    expect(custom.getByText("foto")).toBeInTheDocument();
  });
});

describe("HeartBurst", () => {
  it("never creates more than 24 particles", () => {
    const particles = createBurstParticles(
      { count: 80, shapes: ["heart", "star"], colors: ["#FF9EC7"], particleSize: 20, direction: -90, spread: 360, power: 1 },
      () => 0.5
    );
    expect(particles).toHaveLength(MAX_BURST_PARTICLES);
    expect(particles[0].shape).toBe("heart");
    expect(particles[1].shape).toBe("star");
  });

  it("fires from a ref and from trigger changes, and reports when done", () => {
    const onDone = vi.fn();
    const ref = createRef<HeartBurstHandle>();
    const { rerender } = render(<HeartBurst ref={ref} trigger={0} onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();

    act(() => ref.current?.fire({ x: 10, y: 10 }));
    expect(onDone).toHaveBeenCalledTimes(1);

    rerender(<HeartBurst ref={ref} trigger={1} onDone={onDone} />);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("renders the confetti variant", () => {
    const ref = createRef<HeartBurstHandle>();
    const { container } = render(<Confetti ref={ref} testID="confetti" />);
    expect(container.querySelector("[data-testid=confetti]")).not.toBeNull();
    expect(typeof ref.current?.fire).toBe("function");
  });
});

describe("color utils", () => {
  it("mixes, fades and sanitises ids", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(withAlpha("#2B1938", 0.5)).toBe("rgba(43, 25, 56, 0.5)");
    expect(svgSafeId("x", ":r1:")).toBe("x-r1");
    expect(svgSafeId("x", "«r2»")).toBe("x-r2");
  });
});
