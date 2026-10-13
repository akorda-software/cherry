import { describe, expect, it, vi } from "vitest";

import type { SessionBundle } from "@cherry/contracts";
import type { HttpClient } from "@cherry/mobile-shared";

import { createTestSignInService } from "./test-sign-in-service";

const session: SessionBundle = {
  accessToken: "access-token",
  accessTokenExpiresAt: "2026-04-12T21:00:00Z",
  refreshToken: "refresh-token",
  refreshTokenExpiresAt: "2026-04-19T21:00:00Z",
  user: { id: "user-1", email: "demo@cherry.dev", displayName: "Lucía" }
};

function setup() {
  const post = vi.fn(async () => session);
  const write = vi.fn(async () => undefined);
  const httpClient = { post } as unknown as HttpClient;
  const service = createTestSignInService({
    httpClient,
    storage: { read: async () => null, write, clear: async () => undefined }
  });

  return { service, post, write };
}

describe("createTestSignInService", () => {
  it("posts an empty body to sign in as the shared test user", async () => {
    const { service, post, write } = setup();

    await expect(service.execute()).resolves.toEqual(session);

    expect(post).toHaveBeenCalledWith("/api/auth/dev/test-login", {});
    expect(write).toHaveBeenCalledWith(session);
  });

  it("sends the email when signing in as a specific persona", async () => {
    const { service, post } = setup();

    await service.execute("  demo@cherry.dev ");

    expect(post).toHaveBeenCalledWith("/api/auth/dev/test-login", { email: "demo@cherry.dev" });
  });

  it("falls back to the shared test user when the email is blank", async () => {
    const { service, post } = setup();

    await service.execute("   ");

    expect(post).toHaveBeenCalledWith("/api/auth/dev/test-login", {});
  });
});
