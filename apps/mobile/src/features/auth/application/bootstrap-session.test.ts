import { describe, expect, it } from "vitest";

import { createBootstrapSession } from "./bootstrap-session";
import type { SessionBundle } from "@snack/contracts";

const session: SessionBundle = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-12T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User"
  }
};

describe("createBootstrapSession", () => {
  it("returns the cached session bundle when secure storage has one", async () => {
    const service = createBootstrapSession({
      storage: {
        read: async () => session,
        write: async () => undefined,
        clear: async () => undefined
      }
    });

    await expect(service.execute()).resolves.toEqual(session);
  });

  it("returns null when secure storage is empty", async () => {
    const service = createBootstrapSession({
      storage: {
        read: async () => null,
        write: async () => undefined,
        clear: async () => undefined
      }
    });

    await expect(service.execute()).resolves.toBeNull();
  });
});
