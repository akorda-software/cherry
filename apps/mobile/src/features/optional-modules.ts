import type { SessionBundle } from "@snack/contracts";

import { canAccessDomain, createDomainViewer, type DomainAccessRule } from "../shared/authz/domain-access";

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

export const optionalStackScreens: readonly OptionalModuleScreen[] = [];

export const optionalShellRoutes = Object.fromEntries(
  optionalStackScreens.map((screen) => [screen.name, screen.path])
) as Record<string, string>;

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
    .filter((screen) => canAccessDomain(viewer, (screen as OptionalModuleScreen).access))
    .map((screen) => ({
      href: screen.path,
      label: screen.navigation?.label ?? screen.title,
      title: screen.title
    }));
}
