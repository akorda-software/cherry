import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePathname, useRouter } from "expo-router";

import LoginRoute from "../../app/(public)/login";
import { PublicLayout } from "../../app/(public)/_layout";
import { PrivateLayout } from "../../app/(app)/_layout";
import SettingsRoute from "../../app/(app)/settings";
import HomeRoute from "../../app/(app)/(tabs)/home";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

function AppRouteHost() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      <button onClick={() => router.back()} type="button">
        Go back
      </button>

      {pathname === "/(public)/login" ? (
        <PublicLayout>
          <LoginRoute />
        </PublicLayout>
      ) : pathname === "/(app)/settings" ? (
        <PrivateLayout>
          <SettingsRoute />
        </PrivateLayout>
      ) : (
        <PrivateLayout>
          <HomeRoute />
        </PrivateLayout>
      )}
    </>
  );
}

describe("logout flow", () => {
  it("replaces to login and prevents private shell content from reopening via back navigation", async () => {
    const revoke = vi.fn(async () => undefined);

    renderRoute(<AppRouteHost />, {
      initialPath: "/(app)/settings",
      services: {
        bootstrapSession: {
          execute: async () => sessionFixture
        },
        logoutSession: {
          execute: revoke
        }
      }
    });

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(revoke).toHaveBeenCalledWith(sessionFixture);
      expect(screen.getByTestId("pathname")).toHaveTextContent("/(public)/login");
    });

    expect(screen.getByRole("heading", { name: "Welcome to Snack" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));

    await waitFor(() => {
      expect(screen.queryByTestId("settings-screen")).not.toBeInTheDocument();
      expect(screen.queryByTestId("home-screen")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Welcome to Snack" })).toBeInTheDocument();
    });
  });
});
