import type { SessionBundle } from "@snack/contracts";

import { canAccessDomain, createDomainViewer, type DomainAccessRule } from "../shared/authz/domain-access";
import { subscriptionsRoute } from "./subscriptions/route-config";

interface OptionalModuleNavigationEntry {
  label: string;
}

export interface OptionalModuleScreen {
  name: string;
  path: string;
  title: string;
  featureFlag?: string;
  access?: DomainAccessRule;
  navigation?: OptionalModuleNavigationEntry;
}

export interface OptionalModuleVisibilityContext {
  session: SessionBundle | null;
  features?: Record<string, boolean>;
}

export const optionalStackScreens = [subscriptionsRoute] as const satisfies readonly OptionalModuleScreen[];

export const optionalShellRoutes = Object.fromEntries(
  optionalStackScreens.map((screen) => [screen.name, screen.path])
) as Record<(typeof optionalStackScreens)[number]["name"], (typeof optionalStackScreens)[number]["path"]>;

export function resolveOptionalShellTitle(pathname: string): string | null {
  const match = optionalStackScreens.find((screen) => screen.path === pathname);
  return match?.title ?? null;
}

export function resolveOptionalNavigationEntries({
  session,
  features = {}
}: OptionalModuleVisibilityContext) {
  const viewer = createDomainViewer(session);

  return optionalStackScreens
    .filter((screen) => screen.navigation !== undefined)
    .filter((screen) => screen.featureFlag === undefined || features[screen.featureFlag] === true)
    .filter((screen) => canAccessDomain(viewer, screen.access))
    .map((screen) => ({
      href: screen.path,
      label: screen.navigation?.label ?? screen.title,
      title: screen.title
    }));
}
