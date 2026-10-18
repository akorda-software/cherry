import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "./auth-api";
import { createAuthMethodsApi } from "./auth-methods-api";

describe("auth methods API", () => {
  it("uses only the current-user endpoints and sends proofs in bodies, never URLs", async () => {
    const client = { get: vi.fn(), post: vi.fn(), put: vi.fn() } as unknown as HttpClient;
    const api = createAuthMethodsApi(client);
    const proof = { currentProvider: "google" as const, currentCredential: { providerToken: "synthetic-current" }, credential: { providerToken: "synthetic-added" } };
    await api.list();
    await api.link("apple", proof);
    await api.unlink("apple", proof);
    expect(client.get).toHaveBeenCalledWith("/api/me/auth-methods");
    expect(client.post).toHaveBeenNthCalledWith(1, "/api/me/auth-methods/apple", proof);
    expect(client.post).toHaveBeenNthCalledWith(2, "/api/me/auth-methods/apple/unlink", proof);
  });
});
