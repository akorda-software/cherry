import { describe, expect, it } from "vitest";

import { canAccessDomain, createDomainViewer } from "./domain-access";

describe("domain access", () => {
  it("allows access when no rule is provided", () => {
    expect(canAccessDomain({ roles: [], tier: null })).toBe(true);
  });

  it("matches when the viewer has at least one required role", () => {
    expect(canAccessDomain({ roles: ["member", "admin"], tier: null }, { roles: ["admin"] })).toBe(
      true
    );
  });

  it("rejects when the viewer does not have a required role", () => {
    expect(canAccessDomain({ roles: ["member"], tier: null }, { roles: ["admin"] })).toBe(false);
  });

  it("matches when the viewer has a required tier", () => {
    expect(canAccessDomain({ roles: [], tier: "pro" }, { tiers: ["pro", "plus"] })).toBe(true);
  });

  it("rejects when the viewer does not match the tier", () => {
    expect(canAccessDomain({ roles: [], tier: "free" }, { tiers: ["pro"] })).toBe(false);
  });

  it("normalizes missing roles and tier from the session", () => {
    expect(
      createDomainViewer({
        accessToken: "access-token",
        accessTokenExpiresAt: "2026-04-13T21:00:00Z",
        refreshToken: "refresh-token",
        refreshTokenExpiresAt: "2026-04-20T21:00:00Z",
        user: {
          id: "user-1",
          email: "user@example.com",
          displayName: "User"
        }
      })
    ).toEqual({ roles: [], tier: null });
  });
});
