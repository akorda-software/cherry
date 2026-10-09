import { describe, expect, it } from "vitest";

import { POLAROID_MARGIN, SWIPE_FOOTER_HEIGHT, swipeFooterHit, swipePhotoHeight } from "./swipe-card-face";

describe("swipeFooterHit (botones del pie de la card)", () => {
  const width = 340;
  const height = 560;
  const footerY = height - POLAROID_MARGIN - SWIPE_FOOTER_HEIGHT / 2;

  it("maps the footer row to ✕, ↺, Ver perfil and ♥ from left to right", () => {
    expect(swipeFooterHit(30, footerY, width, height)).toBe("dislike");
    expect(swipeFooterHit(95, footerY, width, height)).toBe("undo");
    expect(swipeFooterHit(width / 2 + 20, footerY, width, height)).toBe("open");
    expect(swipeFooterHit(width - 40, footerY, width, height)).toBe("like");
  });

  it("ignores taps above the footer (photo and info keep their own behaviour)", () => {
    expect(swipeFooterHit(30, 200, width, height)).toBeNull();
    expect(swipeFooterHit(width - 40, height - POLAROID_MARGIN - SWIPE_FOOTER_HEIGHT - 20, width, height)).toBeNull();
  });

  it("leaves room for the info strip and the footer under the photo", () => {
    expect(swipePhotoHeight(height)).toBeLessThanOrEqual(height - 2 * POLAROID_MARGIN - SWIPE_FOOTER_HEIGHT - 100);
  });
});
