import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { createFreshTestEmail, DEMO2_TEST_EMAIL, DEMO_TEST_EMAIL } from "./auth-action-list";
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
