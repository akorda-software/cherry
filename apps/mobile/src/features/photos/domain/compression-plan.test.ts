import { describe, expect, it } from "vitest";

import {
  centerCropRect,
  COMPRESSION_LADDER,
  MAX_PHOTO_LONG_SIDE,
  plannedOutputSize,
  resizeTarget
} from "./compression-plan";

describe("centerCropRect (3:4 portrait)", () => {
  it("crops the sides of a landscape photo", () => {
    expect(centerCropRect(4032, 3024)).toEqual({ originX: 882, originY: 0, width: 2268, height: 3024 });
  });

  it("crops top and bottom of a tall 9:16 photo", () => {
    expect(centerCropRect(1080, 1920)).toEqual({ originX: 0, originY: 240, width: 1080, height: 1440 });
  });

  it("crops a square to 3:4", () => {
    expect(centerCropRect(1000, 1000)).toEqual({ originX: 125, originY: 0, width: 750, height: 1000 });
  });

  it("leaves photos that are already 3:4 (±1%) alone", () => {
    expect(centerCropRect(3024, 4032)).toBeNull();
    expect(centerCropRect(1080, 1438)).toBeNull();
  });

  it("ignores unknown sizes", () => {
    expect(centerCropRect(0, 0)).toBeNull();
    expect(centerCropRect(Number.NaN, 100)).toBeNull();
  });

  it("stays inside the image", () => {
    for (const [width, height] of [
      [4031, 3023],
      [1, 999],
      [999, 1],
      [4000, 6000]
    ]) {
      const crop = centerCropRect(width, height);
      if (!crop) continue;
      expect(crop.originX).toBeGreaterThanOrEqual(0);
      expect(crop.originY).toBeGreaterThanOrEqual(0);
      expect(crop.originX + crop.width).toBeLessThanOrEqual(width);
      expect(crop.originY + crop.height).toBeLessThanOrEqual(height);
    }
  });
});

describe("resizeTarget", () => {
  it("brings the long side down to 1440", () => {
    expect(resizeTarget(2268, 3024)).toEqual({ width: 1080, height: MAX_PHOTO_LONG_SIDE });
    expect(resizeTarget(3000, 1000)).toEqual({ width: 1440, height: 480 });
  });

  it("does not upscale small photos", () => {
    expect(resizeTarget(900, 1200)).toBeNull();
    expect(resizeTarget(1080, 1440)).toBeNull();
  });
});

describe("compression ladder", () => {
  it("starts at JPEG 0.8 / 1440 px and only gets more aggressive", () => {
    expect(COMPRESSION_LADDER[0]).toEqual({ quality: 0.8, maxLongSide: 1440 });
    for (let index = 1; index < COMPRESSION_LADDER.length; index += 1) {
      expect(COMPRESSION_LADDER[index].quality).toBeLessThanOrEqual(COMPRESSION_LADDER[index - 1].quality);
      expect(COMPRESSION_LADDER[index].maxLongSide).toBeLessThanOrEqual(COMPRESSION_LADDER[index - 1].maxLongSide);
    }
  });

  it("predicts the output size of a phone photo", () => {
    expect(plannedOutputSize(4032, 3024, COMPRESSION_LADDER[0])).toEqual({ width: 1080, height: 1440 });
    expect(plannedOutputSize(800, 800, COMPRESSION_LADDER[0])).toEqual({ width: 600, height: 800 });
  });
});
