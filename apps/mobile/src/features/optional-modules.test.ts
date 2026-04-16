import { describe, expect, it } from "vitest";

import { resolveOptionalNavigationEntries } from "./optional-modules";

const session = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-13T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-20T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User",
    roles: ["member"],
    tier: "free"
  }
} as const;

describe("optional modules registry", () => {
  it("hides navigation entries when the module feature flag is disabled", () => {
    expect(resolveOptionalNavigationEntries({ session, features: { subscriptions: false } })).toEqual([]);
  });

  it("exposes navigation entries when the module feature flag is enabled", () => {
    expect(resolveOptionalNavigationEntries({ session, features: { subscriptions: true } })).toEqual([
      {
        href: "/(app)/subscriptions",
        label: "Manage subscription",
        title: "Subscription"
      }
    ]);
  });
});
