import { describe, expect, it, vi } from "vitest";
import { createPhotoAccessApi } from "./photo-access-api";
import type { HttpClient } from "./auth-api";

describe("private photo renewal API", () => {
  it("sends only the object key over the authenticated client, never the bearer URL", async () => {
    const post = vi.fn().mockResolvedValue({ url: "https://r2.test/signed", expiresAt: "2026-10-17T10:05:00Z" });
    const api = createPhotoAccessApi({ post } as unknown as HttpClient);
    expect(await api.renew("photos/a.jpg")).toHaveProperty("url");
    expect(post).toHaveBeenCalledWith("/api/photos/read-url", { storageKey: "photos/a.jpg" });
  });
});
