import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRoute } from "../../../../test/router/render-route";
import { BootSplashGate, isBootSettled } from "./boot-splash-gate";

describe("isBootSettled", () => {
  it("waits for the session, and for the bootstrap when there is one", () => {
    expect(isBootSettled("loading", "idle")).toBe(false);
    expect(isBootSettled("signed-out", "idle")).toBe(true);
    expect(isBootSettled("signed-in", "idle")).toBe(false);
    expect(isBootSettled("signed-in", "loading")).toBe(false);
    expect(isBootSettled("signed-in", "ready")).toBe(true);
    // Con error también: la app enseña su pantalla de reintento, no el splash.
    expect(isBootSettled("signed-in", "error")).toBe(true);
  });
});

describe("BootSplashGate", () => {
  it("covers the start and goes away once the person is known to be signed out", async () => {
    renderRoute(<BootSplashGate />);

    expect(screen.getByTestId("boot-splash")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("boot-splash")).not.toBeInTheDocument(), { timeout: 3000 });
  });
});
