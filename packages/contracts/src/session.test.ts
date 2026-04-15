import { describe, expect, it } from "vitest";

import { createSessionBundle } from "./session";

describe("createSessionBundle", () => {
  it("returns the backend-issued access and refresh token bundle", () => {
    expect(
      createSessionBundle({
        accessToken: "access-1",
        accessTokenExpiresAt: "2026-04-12T21:00:00Z",
        refreshToken: "refresh-1",
        refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
        user: {
          id: "user-1",
          email: "user-1@example.com",
          displayName: "User One"
        }
      })
    ).toEqual({
      accessToken: "access-1",
      accessTokenExpiresAt: "2026-04-12T21:00:00Z",
      refreshToken: "refresh-1",
      refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
      user: {
        id: "user-1",
        email: "user-1@example.com",
        displayName: "User One"
      }
    });
  });

  it("keeps nullable profile fields intact for bootstrap recovery", () => {
    expect(
      createSessionBundle({
        accessToken: "access-2",
        accessTokenExpiresAt: "2026-04-13T21:00:00Z",
        refreshToken: "refresh-2",
        refreshTokenExpiresAt: "2026-04-20T21:00:00Z",
        user: {
          id: "user-2",
          email: "user-2@example.com",
          displayName: null
        }
      })
    ).toEqual({
      accessToken: "access-2",
      accessTokenExpiresAt: "2026-04-13T21:00:00Z",
      refreshToken: "refresh-2",
      refreshTokenExpiresAt: "2026-04-20T21:00:00Z",
      user: {
        id: "user-2",
        email: "user-2@example.com",
        displayName: null
      }
    });
  });
});
