import { usePathname } from "expo-router";
import type { PropsWithChildren, ReactElement } from "react";
import { render } from "@testing-library/react";

import type { BootstrapConfig } from "@cherry/contracts";

import {
  AppBootstrapProvider,
  type AppBootstrapService,
  createMockAppBootstrapService
} from "../../src/features/app-bootstrap";
import {
  SessionShellProvider,
  type SessionShellServices
} from "../../src/features/auth/presentation";
import { RuntimeConfigProvider } from "../../src/shared/config";
import { ThemeProvider } from "../../src/shared/ui";
import { RouterProvider } from "../mocks/expo-router";
import { createSessionShellServices } from "./session-shell.fixture";

interface RenderRouteOptions {
  initialPath?: string;
  services?: Partial<SessionShellServices>;
  featureFlags?: Record<string, boolean>;
  /** Lo que devolvería `GET /api/config` (instancia, edad mínima); por defecto, sin datos. */
  bootstrapConfig?: BootstrapConfig;
  onboardingRequired?: boolean;
  /** Bootstrap propio (p. ej. para reflejar una pausa); por defecto, el mock según `onboardingRequired`. */
  appBootstrapService?: AppBootstrapService;
}

const EMPTY_BOOTSTRAP_CONFIG: BootstrapConfig = { features: {} };

function PathProbe() {
  return <output data-testid="pathname">{usePathname()}</output>;
}

function TestProviders({
  children,
  initialPath,
  services,
  featureFlags = {},
  bootstrapConfig,
  onboardingRequired = false,
  appBootstrapService
}: PropsWithChildren<RenderRouteOptions>) {
  const reader = {
    isEnabled(flagKey: string) {
      return featureFlags[flagKey] ?? false;
    }
  };

  return (
    <RouterProvider initialPath={initialPath}>
      <ThemeProvider>
        <RuntimeConfigProvider
          apiBaseUrl="http://localhost:4000"
          bootstrapConfig={bootstrapConfig ?? EMPTY_BOOTSTRAP_CONFIG}
          reader={reader}
          loading={false}
        >
          <SessionShellProvider services={createSessionShellServices(services)}>
            <AppBootstrapProvider
              service={
                appBootstrapService ??
                createMockAppBootstrapService({
                  onboardingRequired,
                  isComplete: !onboardingRequired,
                  isDiscoverable: !onboardingRequired,
                  nextOnboardingStep: onboardingRequired ? "name" : null
                })
              }
            >
              {children}
              <PathProbe />
            </AppBootstrapProvider>
          </SessionShellProvider>
        </RuntimeConfigProvider>
      </ThemeProvider>
    </RouterProvider>
  );
}

export function renderRoute(route: ReactElement, options: RenderRouteOptions = {}) {
  return render(
    <TestProviders
      initialPath={options.initialPath}
      services={options.services}
      featureFlags={options.featureFlags}
      bootstrapConfig={options.bootstrapConfig}
      onboardingRequired={options.onboardingRequired}
      appBootstrapService={options.appBootstrapService}
    >
      {route}
    </TestProviders>
  );
}
