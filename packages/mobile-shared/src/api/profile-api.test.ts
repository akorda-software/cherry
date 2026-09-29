import { describe, expect, it, vi } from "vitest";

import type { PhotoUploadIntent, ProfilePhoto, Tag } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { createProfileApi } from "./profile-api";

const tag: Tag = {
  id: "t1",
  slug: "music",
  label: "Música",
  category: "interests",
  sortOrder: 1,
  emoji: "🎵"
};

const photo: ProfilePhoto = {
  id: "photo-1",
  storageKey: "profiles/p1/photo-1.jpg",
  url: "https://cdn.example.com/profiles/p1/photo-1.jpg",
  position: 1,
  isActive: true
};

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

  describe("updateLocation", () => {
    it("POSTs the latitude/longitude contract instead of lat/lng", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({ ok: true });

      const api = createProfileApi(http);
      await api.updateLocation({
        latitude: 40.4168,
        longitude: -3.7038,
        accuracyMeters: 25,
        recordedAt: "2026-09-29T10:00:00Z"
      });

      expect(http.post).toHaveBeenCalledWith("/api/me/location", {
        latitude: 40.4168,
        longitude: -3.7038,
        accuracyMeters: 25,
        recordedAt: "2026-09-29T10:00:00Z"
      });
    });

    it("omits optional fields that were not provided", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({ ok: true });

      const api = createProfileApi(http);
      await api.updateLocation({ latitude: 41.3874, longitude: 2.1686 });

      expect(http.post).toHaveBeenCalledWith("/api/me/location", {
        latitude: 41.3874,
        longitude: 2.1686
      });
    });
  });

  describe("photos", () => {
    it("lists own photos unwrapping the photos array", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.get).mockResolvedValueOnce({ photos: [photo] });

      const api = createProfileApi(http);
      const result = await api.listPhotos();

      expect(http.get).toHaveBeenCalledWith("/api/me/photos");
      expect(result).toEqual([photo]);
    });

    it("requests an upload intent with camelCase fields", async () => {
      const http = createMockHttpClient();
      const intent: PhotoUploadIntent = {
        storageKey: "profiles/p1/new.jpg",
        uploadUrl: "https://r2.example.com/signed",
        publicUrl: "https://cdn.example.com/profiles/p1/new.jpg",
        method: "PUT",
        headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
        expiresAt: "2026-09-29T10:10:00Z",
        maxBytes: 2_000_000
      };
      vi.mocked(http.post).mockResolvedValueOnce(intent);

      const api = createProfileApi(http);
      const result = await api.createPhotoUploadIntent({
        position: 2,
        contentType: "image/jpeg",
        sizeBytes: 123_456
      });

      expect(http.post).toHaveBeenCalledWith("/api/me/photos/upload-intent", {
        position: 2,
        contentType: "image/jpeg",
        sizeBytes: 123_456
      });
      expect(result).toEqual(intent);
    });

    it("completes an upload and returns the registered photo", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.post).mockResolvedValueOnce({ photo });

      const api = createProfileApi(http);
      const result = await api.completePhotoUpload({
        storageKey: "profiles/p1/photo-1.jpg",
        publicUrl: "https://cdn.example.com/profiles/p1/photo-1.jpg",
        position: 1,
        contentType: "image/jpeg",
        sizeBytes: 123_456,
        width: 1080
      });

      expect(http.post).toHaveBeenCalledWith("/api/me/photos/complete", {
        storageKey: "profiles/p1/photo-1.jpg",
        publicUrl: "https://cdn.example.com/profiles/p1/photo-1.jpg",
        position: 1,
        contentType: "image/jpeg",
        sizeBytes: 123_456,
        width: 1080
      });
      expect(result).toEqual(photo);
    });

    it("deletes a photo through the DELETE verb", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.delete!).mockResolvedValueOnce({ ok: true });

      const api = createProfileApi(http);
      await api.deletePhoto("photo-1");

      expect(http.delete).toHaveBeenCalledWith("/api/me/photos/photo-1", {});
    });

    it("fails loudly when the http client cannot DELETE", async () => {
      const http = { get: vi.fn(), post: vi.fn(), put: vi.fn() } as unknown as HttpClient;

      const api = createProfileApi(http);

      await expect(api.deletePhoto("photo-1")).rejects.toThrow("HttpClient.delete is required");
    });

    it("reorders photos with photoIds", async () => {
      const http = createMockHttpClient();
      vi.mocked(http.put).mockResolvedValueOnce({ photos: [photo] });

      const api = createProfileApi(http);
      const result = await api.reorderPhotos(["photo-1"]);

      expect(http.put).toHaveBeenCalledWith("/api/me/photos/order", { photoIds: ["photo-1"] });
      expect(result).toEqual([photo]);
    });
  });
});
