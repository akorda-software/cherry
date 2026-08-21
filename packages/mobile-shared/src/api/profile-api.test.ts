import { describe, expect, it, vi } from "vitest";

import type { Tag } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { createProfileApi } from "./profile-api";

const tag: Tag = { id: "t1", slug: "music", label: "Música", category: "interests", sortOrder: 1 };

describe("createProfileApi", () => {
  function createMockHttpClient() {
    return {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    } as unknown as HttpClient;
  }

  describe("getTagCatalog", () => {
    it("GETs the catalog and unwraps the tags array", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ tags: [tag] });

      const api = createProfileApi(http);
      const result = await api.getTagCatalog();

      expect(http.get).toHaveBeenCalledWith("/api/tags");
      expect(result).toEqual([tag]);
    });
  });

  describe("setPositiveTags", () => {
    it("PUTs snake_case tag_ids to the positive tags endpoint", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.put).mockResolvedValueOnce({ tags: [tag] });

      const api = createProfileApi(http);
      const result = await api.setPositiveTags(["t1"]);

      expect(http.put).toHaveBeenCalledWith("/api/me/tags", { tag_ids: ["t1"] });
      expect(result).toEqual([tag]);
    });
  });

  describe("setBlockedTags", () => {
    it("PUTs snake_case tag_ids to the blocked tags endpoint", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.put).mockResolvedValueOnce({ blockedTags: [tag] });

      const api = createProfileApi(http);
      const result = await api.setBlockedTags(["t1"]);

      expect(http.put).toHaveBeenCalledWith("/api/me/blocked-tags", { tag_ids: ["t1"] });
      expect(result).toEqual([tag]);
    });
  });
});
