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
};

describe("optional modules registry", () => {
  it("returns no navigation entries when the registry is empty", () => {
    expect(resolveOptionalNavigationEntries({ session, features: { anyModule: true } })).toEqual([]);
  });
});
