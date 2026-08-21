import { describe, expect, it, vi } from "vitest";

import type { DiscoveryActionResponse, DiscoveryFeedPage } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { createDiscoveryApi } from "./discovery-api";

describe("createDiscoveryApi", () => {
  function createMockHttpClient() {
    return {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn()
    } as unknown as HttpClient;
  }

  describe("getFeed", () => {
    it("requests the feed root when no query is provided", async () => {
      const http = createMockHttpClient();
      const page: DiscoveryFeedPage = { profiles: [], nextCursor: null };
      vi.mocked(http.get).mockResolvedValueOnce(page);

      const api = createDiscoveryApi(http);
      const result = await api.getFeed();

      expect(http.get).toHaveBeenCalledWith("/api/discovery/feed");
      expect(result).toEqual(page);
    });

    it("appends limit and cursor as query parameters", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ profiles: [], nextCursor: null });

      const api = createDiscoveryApi(http);
      await api.getFeed({ limit: 20, cursor: "2026-06-17T00:00:00Z" });

      expect(http.get).toHaveBeenCalledWith(
        "/api/discovery/feed?limit=20&cursor=2026-06-17T00%3A00%3A00Z"
      );
    });

    it("omits the cursor when it is null", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ profiles: [], nextCursor: null });

      const api = createDiscoveryApi(http);
      await api.getFeed({ limit: 10, cursor: null });

      expect(http.get).toHaveBeenCalledWith("/api/discovery/feed?limit=10");
    });
  });

  describe("recordAction", () => {
    it("POSTs snake_case payloads to the actions endpoint", async () => {
      const http = createMockHttpClient();
      const response: DiscoveryActionResponse = { matchCreated: false };
      vi.mocked(http.post).mockResolvedValueOnce(response);

      const api = createDiscoveryApi(http);
      const result = await api.recordAction({ targetProfileId: "profile-1", actionType: "like" });

      expect(http.post).toHaveBeenCalledWith("/api/discovery/actions", {
        target_profile_id: "profile-1",
        action_type: "like"
      });
      expect(result).toEqual({ matchCreated: false });
    });

    it("returns the created match when the like is mutual", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({
        matchCreated: true,
        match: {
          id: "match-1",
          matchedAt: "2026-06-17T00:00:00Z",
          expiresAt: "2026-06-24T00:00:00Z",
          otherProfile: { id: "profile-1", displayName: "Ada", age: 30 }
        }
      });

      const api = createDiscoveryApi(http);
      const result = await api.recordAction({ targetProfileId: "profile-1", actionType: "like" });

      expect(result.matchCreated).toBe(true);
    });
  });
});
