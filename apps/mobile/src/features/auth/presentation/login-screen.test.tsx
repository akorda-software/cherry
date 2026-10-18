import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HEART } from "../../../shared/ui/art/icon-paths";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { createFreshTestEmail, DEMO2_TEST_EMAIL, DEMO_TEST_EMAIL } from "./auth-action-list";
import { driftOpacity, LOGIN_DRIFTS } from "./login-backdrop";
import { LoginScreen } from "./login-screen";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

const platform = Platform as { OS: string };

const googlePayload = {
  providerToken: "google-token",
  device: { installationId: "device-1", platform: "android" as const, deviceName: "Pixel" }
};
const originalOS = platform.OS;

describe("LoginScreen", () => {
  // Sign in with Apple only exists natively on iOS: the provider tests run as iOS.
  beforeEach(() => {
    platform.OS = "ios";
  });

  afterEach(() => {
    platform.OS = originalOS;
  });

  it("welcomes with a plain headline, no slogans, and both providers", async () => {
    renderRoute(<LoginScreen />);

    expect(await screen.findByRole("heading", { name: /Conoce gente\s+cerca de ti\./ })).toBeInTheDocument();
    expect(screen.queryByText(/gratis|trucos|muros de pago|código abierto/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar con Apple" })).toBeInTheDocument();
  });

  it.each([
    ["apple", "Apple", "Google"],
    ["google", "Google", "Apple"]
  ] as const)("a %s conflict keeps only the red message and the existing provider buttons", async (attempt, added, original) => {
    const conflict = { execute: async () => { throw Object.assign(new Error("identity_conflict"), { status: 409, code: "identity_conflict" }); } };
    const success = { execute: async () => sessionFixture };
    renderRoute(<LoginScreen />, { services: { completeAuth: {
      apple: attempt === "apple" ? conflict : success,
      google: attempt === "google" ? conflict : success
    } } });
    const providerButton = await screen.findByRole("button", { name: `Continuar con ${added}` });
    const originalButtons = screen.getAllByRole("button");
    fireEvent.click(providerButton);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `Ya existe una cuenta con este correo. Entra con ${original} y vincula ${added} desde Ajustes → Métodos de acceso.`
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toEqual(originalButtons);
    expect(screen.queryByRole("button", { name: /para vincular/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Entra primero con tu método habitual/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Continuar con ${original}` }));
    await waitFor(() => expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/));
  });

  it("greets with Mochi in love, the logo of the app", async () => {
    const view = renderRoute(<LoginScreen />);

    await screen.findByRole("heading", { name: "Conoce gente cerca de ti." });
    const backdrop = screen.getByTestId("login-backdrop");
    const hearts = Array.from(view.container.querySelectorAll("path")).filter(
      (path) => path.getAttribute("d") === HEART && !backdrop.contains(path)
    );
    expect(hearts).toHaveLength(4);
  });

  it("lays everything on the brand yellow, with no white sheet, and keeps the drifting backdrop decorative", async () => {
    renderRoute(<LoginScreen />);

    await screen.findByRole("heading", { name: "Conoce gente cerca de ti." });
    const backdrop = screen.getByTestId("login-backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop.children).toHaveLength(LOGIN_DRIFTS.length);
    const whites = Array.from(screen.getByTestId("login-screen").querySelectorAll<HTMLElement>("div")).filter(
      (node) => node.style.backgroundColor === "rgb(255, 255, 255)" && !node.closest("[data-testid=login-google]")
    );
    expect(whites).toHaveLength(0);
  });

  it("fades the drifting hearts in and out instead of popping them", () => {
    expect(driftOpacity(0, 0.5)).toBe(0);
    expect(driftOpacity(0.5, 0.5)).toBe(0.5);
    expect(driftOpacity(1, 0.5)).toBe(0);
  });

  // Regresión del cierre en Android al volver de Google: si una vista del botón pasa de aplanable a no
  // aplanable según `busy`, Fabric reparenta el logo y el texto («The specified child already has a
  // parent»). El contenido y el cargador viven siempre montados (y con collapsable={false}); solo cambia
  // su opacidad. Aquí: entrar y volver deja exactamente los mismos nodos en su sitio.
  it("returns from «Entrando con Google…» to normal without rebuilding the button", async () => {
    const flow = deferred<never>();

    renderRoute(<LoginScreen />, {
      services: {
        authProviders: {
          google: { authenticate: vi.fn(() => flow.promise) },
          apple: { authenticate: vi.fn(async () => Promise.reject(new Error("unused"))) }
        }
      }
    });

    const google = await screen.findByRole("button", { name: "Continuar con Google" });
    const content = screen.getByTestId("login-google-content");
    const loader = screen.getByTestId("login-google-loader");
    const label = screen.getByText("Continuar con Google");

    fireEvent.click(google);
    await waitFor(() => expect(google).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByTestId("login-google-content")).toBe(content);
    expect(loader).toContainElement(screen.getByLabelText("Entrando con Google…"));
    expect(content).toContainElement(label);

    flow.reject(new Error("Google Sign-In was cancelled by the user"));
    await waitFor(() => expect(screen.queryByLabelText("Entrando con Google…")).not.toBeInTheDocument());
    expect(google).not.toBeDisabled();
    expect(screen.getByTestId("login-google-content")).toBe(content);
    expect(screen.getByTestId("login-google-loader")).toBe(loader);
    expect(content).toContainElement(label);
    expect(label.parentElement?.parentElement).toBe(content);
  });

  it("shows the loading state on the chosen provider and locks the rest", async () => {
    const flow = deferred<typeof sessionFixture>();

    renderRoute(<LoginScreen />, {
      services: {
        completeAuth: {
          google: { execute: vi.fn(() => flow.promise) },
          apple: { execute: async () => sessionFixture }
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Continuar con Google" }));

    const google = await screen.findByRole("button", { name: "Continuar con Google" });
    await waitFor(() => expect(google).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByLabelText("Entrando con Google…")).toBeInTheDocument();
    expect(google).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continuar con Apple" })).toBeDisabled();

    flow.resolve(sessionFixture);
    await waitFor(() => expect(screen.queryByLabelText("Entrando con Google…")).not.toBeInTheDocument());
  });

  it("explains a failed sign-in kindly, without provider internals", async () => {
    renderRoute(<LoginScreen />, {
      services: {
        authProviders: {
          google: {
            authenticate: async () => ({
              provider: "google",
              payload: {
                providerToken: "google-token",
                device: { installationId: "device-1", platform: "ios", deviceName: "iPhone" }
              }
            })
          },
          apple: {
            authenticate: vi.fn(async () => {
              throw new Error("Apple is unavailable");
            })
          }
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Continuar con Apple" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No hemos podido entrar con Apple. Inténtalo otra vez.");
  });

  it("stays quiet when the person closes the provider sheet", async () => {
    renderRoute(<LoginScreen />, {
      services: {
        authProviders: {
          google: {
            authenticate: vi.fn(async () => {
              throw new Error("Google Sign-In was cancelled by the user");
            })
          },
          apple: {
            authenticate: vi.fn(async () => {
              throw new Error("unused");
            })
          }
        }
      }
    });

    const google = await screen.findByRole("button", { name: "Continuar con Google" });
    fireEvent.click(google);

    await waitFor(() => expect(google).not.toBeDisabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hands off to the index route, which waits for the bootstrap before routing", async () => {
    renderRoute(<LoginScreen />, {
      initialPath: "/(public)/login",
      services: {
        completeAuth: {
          google: { execute: vi.fn(async () => sessionFixture) },
          apple: { execute: async () => sessionFixture }
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Continuar con Google" }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/);
    });
  });

  it("shows «Continuar con Apple» disabled and marked «Próximamente» where there is no flow yet (Android, web)", async () => {
    for (const os of ["android", "web"]) {
      platform.OS = os;
      const appleAuthenticate = vi.fn(async () => {
        throw new Error("unused");
      });
      const view = renderRoute(<LoginScreen />, {
        services: {
          authProviders: {
            google: { authenticate: vi.fn(async () => ({ provider: "google" as const, payload: googlePayload })) },
            apple: { authenticate: appleAuthenticate }
          }
        }
      });

      const google = await screen.findByRole("button", { name: "Continuar con Google" });
      const apple = screen.getByRole("button", { name: "Continuar con Apple" });
      expect(google).not.toBeDisabled();
      expect(apple).toBeDisabled();
      expect(apple).toHaveAttribute("aria-disabled", "true");
      expect(apple).toHaveTextContent("Próximamente");

      fireEvent.click(apple);
      expect(appleAuthenticate).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it("keeps «Continuar con Apple» enabled on iOS, without «Próximamente»", async () => {
    renderRoute(<LoginScreen />);

    const apple = await screen.findByRole("button", { name: "Continuar con Apple" });
    expect(apple).not.toBeDisabled();
    expect(screen.queryByText("Próximamente")).not.toBeInTheDocument();
  });

  it("keeps the stable test ids of the providers and the development shortcuts", async () => {
    renderRoute(<LoginScreen />, { services: { testSignIn: { execute: vi.fn(async () => sessionFixture) } } });

    for (const id of ["login-screen", "login-google", "login-apple", "login-dev-tools", "login-dev-new", "login-dev-demo", "login-dev-demo2"]) {
      expect(await screen.findByTestId(id)).toBeInTheDocument();
    }
  });

  it("offers a second demo persona to try live matches between two sessions", async () => {
    const execute = vi.fn(async (_email?: string) => sessionFixture);

    renderRoute(<LoginScreen />, { services: { testSignIn: { execute } } });

    fireEvent.click(await screen.findByRole("button", { name: "Entrar como Hugo (demo 2)" }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(DEMO2_TEST_EMAIL));
  });

  it("offers the development shortcuts: a brand-new user and the demo persona", async () => {
    const execute = vi.fn(async (_email?: string) => sessionFixture);

    renderRoute(<LoginScreen />, { services: { testSignIn: { execute } } });

    fireEvent.click(await screen.findByRole("button", { name: "Entrar como Lucía (demo)" }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(DEMO_TEST_EMAIL));
  });

  it("signs in a brand-new user with a fresh throwaway email", async () => {
    const execute = vi.fn(async (_email?: string) => sessionFixture);

    renderRoute(<LoginScreen />, { services: { testSignIn: { execute } } });

    fireEvent.click(await screen.findByRole("button", { name: "Entrar como usuario nuevo" }));
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    expect(execute.mock.calls[0]?.[0]).toMatch(/^nuevo-[a-z0-9]+-[a-z0-9]{4}@cherry\.dev$/);
  });
});

describe("createFreshTestEmail", () => {
  it("builds unique-looking throwaway addresses", () => {
    expect(createFreshTestEmail(0, () => 0)).toBe("nuevo-0-0000@cherry.dev");
    expect(createFreshTestEmail(1_700_000_000_000, () => 0.5)).not.toBe(createFreshTestEmail(1_700_000_000_001, () => 0.5));
  });
});
