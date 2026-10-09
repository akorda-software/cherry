import Constants from "expo-constants";
import { fireEvent, screen } from "@testing-library/react";
import { Linking } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderRoute } from "../../../../test/router/render-route";
import { AboutScreen } from "./about-screen";

const extra = (Constants.expoConfig as { extra: Record<string, unknown> }).extra;

describe("AboutScreen", () => {
  afterEach(() => {
    delete extra.sourceUrl;
  });

  it("explains how it works and the license, without slogans or invented links", async () => {
    renderRoute(<AboutScreen />);

    expect(await screen.findByRole("heading", { name: "Cómo funciona" })).toBeInTheDocument();
    expect(screen.getByText("Redondeamos tu ubicación a 500 m. Nunca compartimos la exacta.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Licencia" })).toBeInTheDocument();
    expect(screen.getByText(/licencia AGPL-3\.0/)).toBeInTheDocument();
    expect(screen.queryByText(/gratis|trucos|muros de pago|anuncios/i)).not.toBeInTheDocument();
    expect(screen.getByText(/SIL Open Font License/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver el código" })).not.toBeInTheDocument();
  });

  it("links to the repository when the instance configures it", async () => {
    extra.sourceUrl = "https://code.example.org/snack";
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    renderRoute(<AboutScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver el código" }));
    expect(openURL).toHaveBeenCalledWith("https://code.example.org/snack");
  });
});
