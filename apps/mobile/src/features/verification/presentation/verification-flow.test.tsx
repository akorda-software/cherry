import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LikesRoute from "../../../../app/(app)/(tabs)/likes";
import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { type AppBootstrap, createMockAppBootstrapService } from "../../app-bootstrap";
import { VerificationIntroScreen } from "./verification-intro-screen";
import { VerificationMethodsScreen } from "./verification-methods-screen";
import { verificationRoutes } from "./verification-routes";

// La pantalla real de likes no importa aquí: solo si la pestaña la enseña o no.
vi.mock("../../likes/presentation/likes-screen", () => ({ LikesScreen: () => <div data-testid="likes-screen" /> }));

function bootstrapWith(ageVerification: AppBootstrap["ageVerification"]) {
  const base = createMockAppBootstrapService();
  return {
    async fetchBootstrap(token: string) {
      return { ...(await base.fetchBootstrap(token)), ageVerification };
    }
  };
}

describe("age verification flow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains why before choosing how, including what happens to minors", async () => {
    renderRoute(<VerificationIntroScreen />, { initialPath: verificationRoutes.intro });

    expect(await screen.findByText("Antes de empezar, comprueba tu edad")).toBeInTheDocument();
    expect(screen.getByText("Cherry es solo para mayores de edad")).toBeInTheDocument();
    expect(screen.getByText("Para frenar bots y perfiles falsos")).toBeInTheDocument();
    expect(screen.getByText("Una persona, una cuenta")).toBeInTheDocument();
    expect(screen.getByTestId("verify-intro-minors")).toHaveTextContent("se borran la cuenta");

    fireEvent.click(screen.getByTestId("verify-intro-next"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.methods);
  });

  it("recommends the DNI and, without a provider, marks the other methods as coming later", async () => {
    renderRoute(<VerificationMethodsScreen />, { initialPath: verificationRoutes.methods });

    const nfc = await screen.findByTestId("verify-method-nfc");
    expect(within(nfc).getByText("Recomendado")).toBeInTheDocument();
    expect(within(screen.getByTestId("verify-method-selfie_provider")).getByText("Próximamente")).toBeInTheDocument();
    expect(within(screen.getByTestId("verify-method-eu_wallet")).getByText("Próximamente")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("verify-method-eu_wallet"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.methods);

    fireEvent.click(nfc);
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.document);
  });

  it("offers the selfie when the server has a provider", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderRoute(<VerificationMethodsScreen />, {
      initialPath: verificationRoutes.methods,
      services: { bootstrapSession: { execute: async () => sessionFixture } },
      appBootstrapService: bootstrapWith({ required: true, status: "unverified", providerAvailable: true })
    });

    await vi.waitFor(() =>
      expect(within(screen.getByTestId("verify-method-selfie_provider")).queryByText("Próximamente")).not.toBeInTheDocument()
    );
    expect(within(screen.getByTestId("verify-method-eu_wallet")).getByText("Próximamente")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("verify-method-selfie_provider"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.selfie);
  });

  it("says the selfie is out for this month when the monthly limit is reached", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderRoute(<VerificationMethodsScreen />, {
      initialPath: verificationRoutes.methods,
      services: { bootstrapSession: { execute: async () => sessionFixture } },
      appBootstrapService: bootstrapWith({
        required: true,
        status: "unverified",
        providerAvailable: false,
        providerLimitReached: true
      })
    });

    const selfie = screen.getByTestId("verify-method-selfie_provider");
    await vi.waitFor(() => expect(within(selfie).getByText("No disponible este mes")).toBeInTheDocument());
    expect(selfie).toHaveTextContent("Vuelve a partir del día 1");

    fireEvent.click(selfie);
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.methods);
  });

  it("the info button lists the NFC countries without starting the DNI flow", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/verification/nfc/countries"
        ? { status: 200, body: { countries: ["PT", "ES", "PE"] } }
        : { status: 404, body: {} }
    );
    renderRoute(<VerificationMethodsScreen />, {
      initialPath: verificationRoutes.methods,
      services: { bootstrapSession: { execute: async () => sessionFixture } }
    });

    fireEvent.click(await screen.findByTestId("verify-nfc-countries"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.methods);

    const list = await screen.findByTestId("nfc-countries-list");
    expect(within(list).getAllByText(/España|Perú|Portugal/).map((node) => node.textContent)).toEqual([
      "España",
      "Perú",
      "Portugal"
    ]);

    fireEvent.change(screen.getByTestId("nfc-countries-search"), { target: { value: "peru" } });
    expect(within(screen.getByTestId("nfc-countries-list")).getByText("Perú")).toBeInTheDocument();
    expect(within(screen.getByTestId("nfc-countries-list")).queryByText("España")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("nfc-countries-search"), { target: { value: "japon" } });
    expect(screen.getByTestId("nfc-countries-empty")).toBeInTheDocument();
  });

  it("an unverified account sees the pending state instead of its likes", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderRoute(<LikesRoute />, {
      initialPath: "/(app)/(tabs)/likes",
      services: { bootstrapSession: { execute: async () => sessionFixture } },
      appBootstrapService: bootstrapWith({ required: true, status: "unverified" })
    });

    expect(await screen.findByTestId("verification-pending-likes")).toHaveTextContent("Comprueba tu edad para empezar");
    expect(screen.queryByTestId("likes-screen")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("verification-pending-likes-cta"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(verificationRoutes.intro);
  });

  it("without the requirement nothing is gated", async () => {
    stubBackend(() => ({ status: 404, body: {} }));
    renderRoute(<LikesRoute />, {
      initialPath: "/(app)/(tabs)/likes",
      services: { bootstrapSession: { execute: async () => sessionFixture } },
      appBootstrapService: bootstrapWith({ required: false, status: "unverified" })
    });

    expect(await screen.findByTestId("likes-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("verification-pending-likes")).not.toBeInTheDocument();
  });
});
