import { describe, expect, it, vi } from "vitest";
import type { HttpClient } from "./auth-api";
import { createCaseworkApi } from "./casework-api";

describe("createCaseworkApi", () => {
  it("uses authenticated self-scoped routes and bounded pages", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ cases: [] }),
      post: vi.fn().mockResolvedValue({ ok: true }),
      put: vi.fn()
    } as unknown as HttpClient;
    const api = createCaseworkApi(client);
    await api.list(50);
    expect(client.get).toHaveBeenCalledWith("/api/me/cases?offset=50");
    await api.notices(100);
    expect(client.get).toHaveBeenCalledWith("/api/me/notices?offset=100");
    await api.get("id/escape");
    expect(client.get).toHaveBeenCalledWith("/api/me/cases/id%2Fescape");
  });

  it("sends only the appeal statement and escapes ids", async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ ok: true }),
      put: vi.fn()
    } as unknown as HttpClient;
    const api = createCaseworkApi(client);
    await api.appeal("id?escape", "Solicito revisión humana.");
    expect(client.post).toHaveBeenCalledWith("/api/me/cases/id%3Fescape/appeal", {
      statement: "Solicito revisión humana."
    });
    await api.readNotice("notice/id");
    expect(client.post).toHaveBeenCalledWith("/api/me/notices/notice%2Fid/read", {});
    const request = { kind: "privacy", category: "access", statement: "Solicito acceso a mis datos." } as const;
    await api.create(request);
    expect(client.post).toHaveBeenCalledWith("/api/me/cases", request);
  });
});
