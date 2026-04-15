import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePathname } from "expo-router";

import { PrivateLayout } from "../../app/(app)/_layout";
import SettingsRoute from "../../app/(app)/settings";
import HomeRoute from "../../app/(app)/(tabs)/home";
import UserRoute from "../../app/(app)/(tabs)/user";
import { PlaceholderScreen } from "../../src/shared/ui/app-shell";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

function AppRouteHost() {
  const pathname = usePathname();

  if (pathname === "/(app)/(tabs)/user") {
    return (
      <PrivateLayout>
        <UserRoute />
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
  it("keeps Home and User tab-owned while exposing matching drawer entries", async () => {
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

    expect(await screen.findByRole("button", { name: "Tab Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tab User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drawer Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Drawer User" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("Home");
    expect(screen.getAllByTestId("home-screen")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Home overview" })).toBeInTheDocument();
  });

  it("routes drawer Home/User actions to the canonical tab paths", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: "Drawer User" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/(tabs)/user");

    fireEvent.click(screen.getByRole("button", { name: "Drawer Home" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/(tabs)/home");
    expect(screen.getByRole("heading", { name: "Home overview" })).toBeInTheDocument();
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

    expect(await screen.findByRole("navigation", { name: "Drawer navigation" })).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("Settings");
    expect(screen.getByTestId("future-feature-screen")).toBeInTheDocument();
    expect(
      screen.getByText("Future feature content can change without rebuilding the private shell.")
    ).toBeInTheDocument();
  });

  it("resolves authenticated deep links to a single canonical screen instance", async () => {
    renderRoute(
      <AppRouteHost />,
      {
        initialPath: "/(app)/(tabs)/user",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findAllByTestId("user-screen")).toHaveLength(1);
    expect(screen.getByText("Signed in as User")).toBeInTheDocument();
  });

  it("renders themed user and settings structures without changing route ownership", async () => {
    renderRoute(
      <AppRouteHost />,
      {
        initialPath: "/(app)/(tabs)/user",
        services: {
          bootstrapSession: {
            execute: async () => sessionFixture
          }
        }
      }
    );

    expect(await screen.findByRole("heading", { name: "User details" })).toBeInTheDocument();
    expect(screen.getByText("Signed in as User")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Drawer Settings" }));

    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/settings");
    expect(screen.getByRole("banner")).toHaveTextContent("Settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
