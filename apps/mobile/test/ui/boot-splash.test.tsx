import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BOOT_SPLASH_INTRO_MS,
  BOOT_SPLASH_MASCOT_SIZE,
  BOOT_SPLASH_MAX_WAIT_MS,
  BootSplash,
  SPLASH_IMAGE_WIDTH
} from "../../src/shared/ui";
import { HEART } from "../../src/shared/ui/art/icon-paths";
import { renderWithTheme } from "./render-with-theme";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("react-native-reanimated", async () => ({
  ...(await import("../mocks/react-native-reanimated")),
  useReducedMotion: () => motion.reduced
}));

describe("BootSplash", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    motion.reduced = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("covers the app with the yellow and the layered logo, announced as loading", () => {
    const { getByTestId, container } = renderWithTheme(<BootSplash onFinish={vi.fn()} ready={false} />);

    const splash = getByTestId("boot-splash");
    expect(splash.getAttribute("role")).toBe("progressbar");
    expect(splash.getAttribute("aria-label")).toBe("Abriendo Cherry");
    expect(splash.style.backgroundColor).toBe("rgb(255, 197, 61)");
    // Mochi enamorada: el cuerpo en una capa y cada ojo de corazón en la suya, para que lata.
    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.querySelectorAll("circle")).toHaveLength(4);
    expect(Array.from(container.querySelectorAll("path")).filter((p) => p.getAttribute("d") === HEART)).toHaveLength(4);
  });

  it("matches the native splash: Mochi is as big as in splash-icon.png at imageWidth", () => {
    expect(SPLASH_IMAGE_WIDTH).toBe(200);
    // Lienzo de 120 a escala 478/57.5 dentro de los 1024 px de splash-icon.png, mostrado a 200 pt.
    expect(BOOT_SPLASH_MASCOT_SIZE).toBeCloseTo((120 * (478 / 57.5) * 200) / 1024, 5);
  });

  it("plays the short intro before fading out when the app is already ready", () => {
    const onFinish = vi.fn();
    renderWithTheme(<BootSplash onFinish={onFinish} ready />);

    act(() => {
      vi.advanceTimersByTime(BOOT_SPLASH_INTRO_MS - 1);
    });
    expect(onFinish).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting after the intro until the app is ready", () => {
    const onFinish = vi.fn();
    const view = renderWithTheme(<BootSplash onFinish={onFinish} ready={false} />);

    act(() => {
      vi.advanceTimersByTime(BOOT_SPLASH_INTRO_MS + 500);
    });
    expect(onFinish).not.toHaveBeenCalled();

    view.rerender(<BootSplash onFinish={onFinish} ready />);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("steps aside anyway if the app takes too long", () => {
    const onFinish = vi.fn();
    renderWithTheme(<BootSplash onFinish={onFinish} ready={false} />);

    act(() => {
      vi.advanceTimersByTime(BOOT_SPLASH_INTRO_MS);
    });
    act(() => {
      vi.advanceTimersByTime(BOOT_SPLASH_MAX_WAIT_MS);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("with reduced motion, skips the intro and only fades once the app is ready", () => {
    motion.reduced = true;
    const onFinish = vi.fn();
    const view = renderWithTheme(<BootSplash onFinish={onFinish} ready={false} />);
    expect(onFinish).not.toHaveBeenCalled();

    view.rerender(<BootSplash onFinish={onFinish} ready />);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
