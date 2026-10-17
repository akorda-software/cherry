import { describe, expect, it } from "vitest";
import { signedPhotoInfo } from "./private-photo";

describe("private photo references", () => {
  it("extracts the managed key and actual signature deadline without persisting the URL", () => {
    const info = signedPhotoInfo("https://account.eu.r2.cloudflarestorage.com/bucket/photos/a.jpg?X-Amz-Date=20261017T100000Z&X-Amz-Expires=300&X-Amz-Signature=sig");
    expect(info).toEqual({ key: "photos/a.jpg", expiresAt: Date.parse("2026-10-17T10:05:00Z") });
  });
  it("leaves local assets alone and never renews pending uploads", () => {
    for (const uri of [undefined, "file:///tmp/a.jpg", "https://example.test/a.jpg", "https://r2.test/bucket/pending/photos/a.jpg?X-Amz-Date=20261017T100000Z&X-Amz-Expires=300&X-Amz-Signature=sig"]) {
      expect(signedPhotoInfo(uri)).toBeNull();
    }
  });
});
