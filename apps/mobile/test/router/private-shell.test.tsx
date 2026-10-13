import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePathname, useRouter } from "expo-router";

import { PrivateLayout } from "../../app/(app)/_layout";
import TabsLayoutRoute from "../../app/(app)/(tabs)/_layout";
import { appShellRoutes, ComingSoonScreen, PlaceholderScreen } from "../../src/shared/ui";
import { renderRoute } from "./render-route";
import { sessionFixture } from "./session-shell.fixture";

const signedIn = {
  services: {
    bootstrapSession: {
      execute: async () => sessionFixture
    }
  }
};

/** Anfitrión mínimo: una pestaña y una pantalla apilada con su propia cabecera. */
function AppRouteHost() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === appShellRoutes.about) {
    return (
      <PrivateLayout>
        <ComingSoonScreen testID="about-screen" title="Sobre Cherry" />
      </PrivateLayout>
    );
  }

  return (
    <PrivateLayout>
      <ComingSoonScreen back={false} testID="likes-screen" title="Likes" />
      <button onClick={() => router.push(appShellRoutes.about)} type="button">
        Abrir sobre Cherry
      </button>
    </PrivateLayout>
  );
}

describe("private shell", () => {
  it("renders tab content inside the private shell with its own large title", async () => {
    renderRoute(
      <PrivateLayout>
        <ComingSoonScreen back={false} testID="likes-screen" title="Likes" />
      </PrivateLayout>,
      { initialPath: appShellRoutes.likes, ...signedIn }
    );

    expect(await screen.findByTestId("likes-screen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Likes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Estamos preparando esta pantalla" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument();
  });

  it("pushes a stacked screen and returns with its back button", async () => {
    renderRoute(<AppRouteHost />, { initialPath: appShellRoutes.likes, ...signedIn });

    expect(await screen.findByTestId("likes-screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir sobre Cherry" }));

    expect(await screen.findByTestId("about-screen")).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent(appShellRoutes.about);

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(await screen.findByTestId("likes-screen")).toBeInTheDocument();
  });

  it("falls back to the root when a deep-linked screen has no history", async () => {
    renderRoute(
      <PrivateLayout>
        <ComingSoonScreen close testID="filters-screen" title="Filtros" />
      </PrivateLayout>,
      { initialPath: appShellRoutes.filters, ...signedIn }
    );

    fireEvent.click(await screen.findByRole("button", { name: "Cerrar" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent(/^\/$/);
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
      { initialPath: appShellRoutes.settings, ...signedIn }
    );

    expect(await screen.findByTestId("future-feature-screen")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Future feature placeholder" })).toBeInTheDocument();
    expect(
      screen.getByText("Future feature content can change without rebuilding the private shell.")
    ).toBeInTheDocument();
  });

  it("mounts the tabs navigator", async () => {
    renderRoute(
      <PrivateLayout>
        <TabsLayoutRoute />
      </PrivateLayout>,
      { initialPath: appShellRoutes.discover, ...signedIn }
    );

    expect(await screen.findByTestId("tabs-navigation")).toBeInTheDocument();
  });
});
