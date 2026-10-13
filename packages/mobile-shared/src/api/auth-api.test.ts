import { describe, expect, it, vi } from "vitest";

import { createSessionApi, type HttpClient } from "./auth-api";

describe("createSessionApi", () => {
  it("revokes with DELETE /api/session", async () => {
    const httpClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(async () => undefined)
    } as unknown as HttpClient;

    await createSessionApi(httpClient).revoke("refresh-1");

    expect(httpClient.delete).toHaveBeenCalledWith("/api/session", { refreshToken: "refresh-1" });
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("fails clearly without a delete-capable client (no fallback route)", async () => {
    const httpClient = { get: vi.fn(), post: vi.fn(), put: vi.fn() } as unknown as HttpClient;

    await expect(createSessionApi(httpClient).revoke("refresh-1")).rejects.toThrow(/DELETE \/api\/session/);
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("refreshes with POST /api/session/refresh", async () => {
    const httpClient = {
      get: vi.fn(),
      post: vi.fn(async () => ({})),
      put: vi.fn(),
      delete: vi.fn()
    } as unknown as HttpClient;

    await createSessionApi(httpClient).refresh("refresh-1");

    expect(httpClient.post).toHaveBeenCalledWith("/api/session/refresh", { refreshToken: "refresh-1" });
  });
});
