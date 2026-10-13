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
    extra.sourceUrl = "https://code.example.org/cherry";
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    renderRoute(<AboutScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "Ver el código" }));
    expect(openURL).toHaveBeenCalledWith("https://code.example.org/cherry");
  });
});

describe("AboutScreen con los datos de la instancia", () => {
  afterEach(() => {
    delete extra.sourceUrl;
  });

  it("says who runs the instance, how to contact and its legal texts", async () => {
    const bootstrapConfig = {
      features: {},
      instance: {
        name: "Cherry France",
        country: "FR",
        locale: "fr-FR",
        operator: "Association Cherry FR",
        contactEmail: "contact@cherry.example",
        privacyUrl: "https://cherry.example/confidentialite",
        termsUrl: "javascript:alert(1)",
        sourceUrl: "https://git.example.org/cherry-fr"
      }
    };
    const openURL = vi.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    renderRoute(<AboutScreen />, { bootstrapConfig });

    expect(await screen.findByRole("heading", { name: "Cherry France" })).toBeInTheDocument();
    expect(screen.getByText("Esta instancia la gestiona Association Cherry FR, de forma independiente.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Escribir a contact@cherry.example" }));
    expect(openURL).toHaveBeenCalledWith("mailto:contact@cherry.example");

    fireEvent.click(screen.getByRole("button", { name: "Política de privacidad" }));
    expect(openURL).toHaveBeenCalledWith("https://cherry.example/confidentialite");

    // Solo enlaces web: una URL rara no se enseña.
    expect(screen.queryByRole("button", { name: "Condiciones de uso" })).not.toBeInTheDocument();

    // Sin URL en la compilación, «Ver el código» usa la del servidor.
    fireEvent.click(screen.getByRole("button", { name: "Ver el código" }));
    expect(openURL).toHaveBeenCalledWith("https://git.example.org/cherry-fr");
  });

  it("without operator data there is no instance section", async () => {
    renderRoute(<AboutScreen />);

    expect(await screen.findByRole("heading", { name: "Cherry" })).toBeInTheDocument();
    expect(screen.queryByText("Quién gestiona esta instancia")).not.toBeInTheDocument();
  });
});
