import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrivateLayout } from "../../app/(app)/_layout";
import HomeRoute from "../../app/(app)/(tabs)/home";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

describe("subscription drawer integration", () => {
  it("renders a subscription drawer entry when the feature flag is enabled", async () => {
    renderRoute(
      <PrivateLayout subscriptionEnabled={true}>
        <HomeRoute />
      </PrivateLayout>,
      {
        initialPath: "/(app)/(tabs)/home",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findByRole("button", { name: "Drawer Subscription" })).toBeInTheDocument();
  });

  it("hides the subscription drawer entry when the feature flag is disabled", async () => {
    renderRoute(
      <PrivateLayout subscriptionEnabled={false}>
        <HomeRoute />
      </PrivateLayout>,
      {
        initialPath: "/(app)/(tabs)/home",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    const drawer = await screen.findByRole("navigation", { name: "Drawer navigation" });
    expect(drawer).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Drawer Subscription" })).not.toBeInTheDocument();
  });

  it("does not render subscription entries when unauthenticated", async () => {
    renderRoute(
      <PrivateLayout subscriptionEnabled={true}>
        <HomeRoute />
      </PrivateLayout>,
      {
        initialPath: "/(app)/(tabs)/home",
        services: {
          bootstrapSession: {
            execute: async () => null
          }
        }
      }
    );

    // PrivateGuard redirects to login, so no drawer should be visible
    await waitFor(() => {
      expect(screen.queryByRole("navigation", { name: "Drawer navigation" })).not.toBeInTheDocument();
    });
  });
});
