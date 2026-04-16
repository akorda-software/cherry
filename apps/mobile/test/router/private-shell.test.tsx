import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePathname } from "expo-router";

import { PrivateLayout } from "../../app/(app)/_layout";
import SettingsRoute from "../../app/(app)/settings";
import HomeRoute from "../../app/(app)/(tabs)/home";
import ProfileRoute from "../../app/(app)/(tabs)/profile";
import { PlaceholderScreen } from "../../src/shared/ui/app-shell";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

function AppRouteHost() {
  const pathname = usePathname();

  if (pathname === "/(app)/(tabs)/profile") {
    return (
      <PrivateLayout>
        <ProfileRoute />
      </PrivateLayout>
    );
  }

  if (pathname === "/(app)/settings") {
    return (
      <PrivateLayout>
        <SettingsRoute />
      </PrivateLayout>
    );
  }

  return (
    <PrivateLayout>
      <HomeRoute />
    </PrivateLayout>
  );
}

describe("private shell", () => {
  it("renders home content inside the private shell", async () => {
    renderRoute(
      <AppRouteHost />,
      {
        initialPath: "/(app)/(tabs)/home",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findAllByTestId("home-screen")).toHaveLength(1);
    expect(screen.getByRole("banner")).toHaveTextContent("Home");
    expect(screen.getByText("Authenticated shell landing content stays feature-owned.")).toBeInTheDocument();
  });

  it("keeps the private shell boundary reusable around non-tab feature content", async () => {
    renderRoute(
      <PrivateLayout>
        <PlaceholderScreen
          description="Future feature content can change without rebuilding the private shell."
          testId="future-feature-screen"
          title="Future feature placeholder"
        />
      </PrivateLayout>,
      {
        initialPath: "/(app)/settings",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findByTestId("future-feature-screen")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("Settings");
    expect(
      screen.getByText("Future feature content can change without rebuilding the private shell.")
    ).toBeInTheDocument();
  });

  it("renders optional module navigation from the registry inside settings", async () => {
    renderRoute(<AppRouteHost />, {
      initialPath: "/(app)/settings",
      featureFlags: { subscriptions: true },
      services: {
        bootstrapSession: {
          execute: async () => sessionFixture
        }
      }
    });

    expect(await screen.findByRole("button", { name: "Manage subscription" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage subscription" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/subscriptions");
  });

  it("resolves authenticated deep links to a single canonical screen instance", async () => {
    renderRoute(
      <AppRouteHost />,
      {
        initialPath: "/(app)/(tabs)/profile",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findAllByTestId("profile-screen")).toHaveLength(1);
    expect(screen.getByText("Signed in as User")).toBeInTheDocument();
  });

  it("renders the profile structure with a logout action", async () => {
    renderRoute(
      <AppRouteHost />,
      {
        initialPath: "/(app)/(tabs)/profile",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findByRole("banner")).toHaveTextContent("Profile");
    expect(screen.getByText("Signed in as User")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });
});
