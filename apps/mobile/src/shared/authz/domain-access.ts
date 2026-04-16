import type { SessionBundle } from "@snack/contracts";

export interface DomainAccessRule {
  roles?: string[];
  tiers?: string[];
}

export interface DomainViewer {
  roles: string[];
  tier: string | null;
}

export function createDomainViewer(session: SessionBundle | null): DomainViewer {
  return {
    roles: session?.user.roles ?? [],
    tier: session?.user.tier ?? null
  };
}

export function canAccessDomain(viewer: DomainViewer, rule?: DomainAccessRule): boolean {
  if (!rule) {
    return true;
  }

  const matchesRole = rule.roles === undefined || rule.roles.some((role) => viewer.roles.includes(role));
  const matchesTier = rule.tiers === undefined || (viewer.tier !== null && rule.tiers.includes(viewer.tier));

  return matchesRole && matchesTier;
}
