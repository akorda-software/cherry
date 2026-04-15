import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
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

describe("LoginScreen", () => {
  it("renders shared screen, card, and auth actions for the login shell", async () => {
    renderRoute(<LoginScreen />);

    expect(await screen.findByRole("heading", { name: "Welcome to Snack" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByText("Reusable auth access for the current app shell.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/");
  });

  it("shows a loading state while Google sign-in is in flight", async () => {
    const flow = deferred<typeof sessionFixture>();

    renderRoute(<LoginScreen />, {
      services: {
        completeAuth: {
          google: {
            execute: vi.fn(() => flow.promise)
          },
          apple: {
            execute: async () => sessionFixture
          }
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByText("Signing in with Google…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeDisabled();

    flow.resolve(sessionFixture);
    await waitFor(() => {
      expect(screen.queryByText("Signing in with Google…")).not.toBeInTheDocument();
    });
  });

  it("shows an error message when Apple sign-in fails", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Apple" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Apple is unavailable");
  });

  it("hands off to the canonical home route after a successful sign-in", async () => {
    renderRoute(<LoginScreen />, {
      services: {
        completeAuth: {
          google: {
            execute: vi.fn(async () => sessionFixture)
          },
          apple: {
            execute: async () => sessionFixture
          }
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/(tabs)/home");
    });
  });
});
