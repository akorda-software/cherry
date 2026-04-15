import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionShellProvider, useSessionShell } from "./session-shell-provider";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";

function SessionProbe() {
  const { state, signOut } = useSessionShell();

  return (
    <>
      <output data-testid="auth-status">{state.status}</output>
      <button onClick={() => void signOut()} type="button">
        Trigger logout
      </button>
    </>
  );
}

describe("SessionShellProvider", () => {
  it("invokes createLogoutSession with the active session and transitions to signed-out", async () => {
    const execute = vi.fn(async () => undefined);

    render(
      <SessionShellProvider
        services={{
          bootstrapSession: {
            execute: async () => sessionFixture
          },
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
              authenticate: async () => ({
                provider: "apple",
                payload: {
                  providerToken: "apple-token",
                  authorizationCode: "auth-code",
                  idToken: "id-token",
                  nonce: "nonce",
                  device: { installationId: "device-1", platform: "ios", deviceName: "iPhone" }
                }
              })
            }
          },
          completeAuth: {
            google: { execute: async () => sessionFixture },
            apple: { execute: async () => sessionFixture }
          },
          logoutSession: {
            execute
          }
        }}
      >
        <SessionProbe />
      </SessionShellProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-status")).toHaveTextContent("signed-in");
    });

    fireEvent.click(screen.getByRole("button", { name: "Trigger logout" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith(sessionFixture);
      expect(screen.getByTestId("auth-status")).toHaveTextContent("signed-out");
    });
  });
});
