import type { PropsWithChildren } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Profile } from "@cherry/contracts";

import { stubBackend } from "../../../../test/fixtures/fake-backend";
import { renderRoute } from "../../../../test/router/render-route";
import { sessionFixture } from "../../../../test/router/session-shell.fixture";
import { useToastStore } from "../../../shared/ui";
import type { AppBootstrapService } from "../../app-bootstrap";
import { useSessionShell } from "../../auth/presentation";
import { PAUSED_MESSAGE } from "../../settings/presentation/use-profile-pause";
import { MeScreen } from "./me-screen";

const signedIn = { bootstrapSession: { execute: async () => sessionFixture } };

function tag(slug: string, category = "interests") {
  return { id: `tag-${slug}`, slug, label: slug, category, emoji: null };
}

function photo(position: number) {
  return {
    id: `photo-${position}`,
    storageKey: `k-${position}`,
    url: `https://img.example/${position}.jpg`,
    position,
    isActive: true
  };
}

function profileFixture(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "me",
    displayName: "Lucía",
    birthDate: "1997-07-14",
    age: 29,
    gender: "woman",
    lookingFor: ["relationship"],
    whatIAmLookingFor: "relationship",
    bio: "Cocino las croquetas de mi abuela mejor que ella (que no se entere).",
    isComplete: true,
    isPaused: false,
    isDiscoverable: true,
    hasLocation: true,
    photos: [photo(1), photo(2), photo(3), photo(4)],
    tags: [tag("viajar"), tag("cocinar"), tag("senderismo", "active"), tag("cafe", "lifestyle")],
    blockedTags: [],
    discoveryPreferences: {
      ageMin: 26,
      ageMax: 38,
      distanceKm: 50,
      showMen: true,
      showWomen: false,
      showNonBinary: true,
      compatibleOnly: false,
      expandDistance: true,
      discoveryMode: "feed"
    },
    insertedAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides
  };
}

/** Como el guard privado: la pantalla solo existe con sesión. */
function SignedInOnly({ children }: PropsWithChildren) {
  const { state } = useSessionShell();
  return state.status === "signed-in" ? <>{children}</> : null;
}

function bootstrapReflecting(isPaused: () => boolean): AppBootstrapService {
  return {
    async fetchBootstrap() {
      return {
        user: { id: "user-1", email: "user@example.com", displayName: "Lucía" },
        profile: {
          exists: true,
          isComplete: true,
          isDiscoverable: !isPaused(),
          isPaused: isPaused(),
          onboardingRequired: false,
          nextOnboardingStep: null
        }
      };
    }
  };
}

describe("MeScreen", () => {
  beforeEach(() => {
    useToastStore.getState().clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows how others see you, that the profile shines and the editing shortcuts", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/profile" ? { body: { profile: profileFixture(), completeness: true } } : { status: 404, body: {} }
    );

    renderRoute(
      <SignedInOnly>
        <MeScreen />
      </SignedInOnly>,
      { services: signedIn, initialPath: "/(app)/(tabs)/me" }
    );

    expect(await screen.findByRole("heading", { name: "Así te ven" })).toBeInTheDocument();
    expect(screen.getByLabelText("Lucía, 29 años")).toBeInTheDocument();
    expect(screen.getByText("Tu perfil brilla")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fotos, 4 de 4" })).toBeInTheDocument();
    expect(screen.getByText("29 años · Mujer · Una relación")).toBeInTheDocument();
    expect(screen.getByText("26–38 años · 50 km")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mis etiquetas, 4 de 8" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/edit/tags");
  });

  it("suggests concrete next steps when something essential is missing", async () => {
    stubBackend(({ path }) =>
      path === "/api/me/profile"
        ? { body: { profile: profileFixture({ isComplete: false, photos: [photo(1)] }), completeness: false } }
        : { status: 404, body: {} }
    );

    renderRoute(
      <SignedInOnly>
        <MeScreen />
      </SignedInOnly>,
      { services: signedIn }
    );

    expect(await screen.findByText("Casi lo tienes")).toBeInTheDocument();
    expect(screen.getByText("Añade 1 foto más: con 2 tu perfil queda listo.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir fotos" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/edit/photos");
  });

  it("pauses the profile, stamps the preview and lets you come back", async () => {
    let paused = false;
    const backend = stubBackend(({ method, path }) => {
      if (path === "/api/me/profile") {
        return { body: { profile: profileFixture({ isPaused: paused }), completeness: true } };
      }
      if (method === "POST" && path === "/api/me/pause") {
        paused = true;
        return { body: { ok: true } };
      }
      if (method === "POST" && path === "/api/me/unpause") {
        paused = false;
        return { body: { ok: true } };
      }
      return { status: 404, body: {} };
    });

    renderRoute(
      <SignedInOnly>
        <MeScreen />
      </SignedInOnly>,
      { services: signedIn, appBootstrapService: bootstrapReflecting(() => paused) }
    );

    fireEvent.click(await screen.findByRole("switch", { name: "Pausar mi perfil" }));

    expect(await screen.findByText(PAUSED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByTestId("me-paused-stamp")).toBeInTheDocument();
    expect(backend.callsTo("/api/me/pause", "POST")).toHaveLength(1);
    await waitFor(() =>
      expect(useToastStore.getState().current?.message).toBe("Perfil en pausa. Tomarte un respiro está bien.")
    );

    // Sin aviso arriba que empuje la pantalla: el estado lo cuenta la propia fila.
    expect(screen.queryByTestId("me-paused-banner")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Pausar mi perfil" }));

    await waitFor(() => expect(screen.queryByText(PAUSED_MESSAGE)).not.toBeInTheDocument());
    expect(backend.callsTo("/api/me/unpause", "POST")).toHaveLength(1);
  });

  it("explains a failed load and retries", async () => {
    let fail = true;
    stubBackend(({ path }) => {
      if (path === "/api/me/profile") {
        return fail ? { status: 503, body: { error: "unavailable" } } : { body: { profile: profileFixture(), completeness: true } };
      }
      return { status: 404, body: {} };
    });

    renderRoute(
      <SignedInOnly>
        <MeScreen />
      </SignedInOnly>,
      { services: signedIn }
    );

    expect(
      await screen.findByText("Algo ha fallado por nuestra parte. Danos un momento y vuelve a probar.")
    ).toBeInTheDocument();

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "Así te ven" })).toBeInTheDocument();
  });

  it("opens the settings from the gear", async () => {
    stubBackend(() => ({ body: { profile: profileFixture(), completeness: true } }));

    renderRoute(
      <SignedInOnly>
        <MeScreen />
      </SignedInOnly>,
      { services: signedIn }
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ajustes" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/(app)/settings");
  });
});
