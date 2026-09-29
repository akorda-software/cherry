import { describe, expect, it } from "vitest";

import { makePhoto } from "../../onboarding/testing/fixtures";
import {
  activePhotos,
  buildPhotoSlots,
  canRemovePhoto,
  nextFreePosition,
  orderWithMainFirst,
  overallUploadProgress,
  remainingPhotoSlots,
  type PendingPhoto
} from "./photo-slots";

const pending = (key: string, position: number, overrides: Partial<PendingPhoto> = {}): PendingPhoto => ({
  key,
  localUri: `file:///${key}.jpg`,
  position,
  stage: "uploading",
  progress: 0.5,
  error: null,
  ...overrides
});

describe("positions", () => {
  it("finds the first free position between 1 and 4", () => {
    expect(nextFreePosition([])).toBe(1);
    expect(nextFreePosition([makePhoto(1), makePhoto(2)])).toBe(3);
    expect(nextFreePosition([makePhoto(2), makePhoto(4)])).toBe(1);
    expect(nextFreePosition([makePhoto(1)], [2, 3])).toBe(4);
    expect(nextFreePosition([makePhoto(1), makePhoto(2)], [3, 4])).toBeNull();
  });

  it("counts remaining slots including uploads in flight", () => {
    expect(remainingPhotoSlots(0, 0)).toBe(4);
    expect(remainingPhotoSlots(2, 1)).toBe(1);
    expect(remainingPhotoSlots(3, 2)).toBe(0);
  });

  it("keeps only active photos, by position", () => {
    const photos = [makePhoto(3), makePhoto(1, { isActive: false, id: "old" }), makePhoto(2)];
    expect(activePhotos(photos).map((photo) => photo.position)).toEqual([2, 3]);
  });
});

describe("orderWithMainFirst", () => {
  const photos = [makePhoto(1), makePhoto(2), makePhoto(3)];

  it("moves the chosen photo to the front and keeps the rest in order", () => {
    expect(orderWithMainFirst(photos, "photo-3")).toEqual(["photo-3", "photo-1", "photo-2"]);
    expect(orderWithMainFirst(photos, "photo-2")).toEqual(["photo-2", "photo-1", "photo-3"]);
  });

  it("returns null when there is nothing to do", () => {
    expect(orderWithMainFirst(photos, "photo-1")).toBeNull();
    expect(orderWithMainFirst(photos, "ghost")).toBeNull();
  });
});

describe("canRemovePhoto", () => {
  it("never lets an edited profile drop below 2 photos", () => {
    expect(canRemovePhoto(2, "edit")).toBe(false);
    expect(canRemovePhoto(3, "edit")).toBe(true);
    expect(canRemovePhoto(1, "onboarding")).toBe(true);
  });
});

describe("buildPhotoSlots", () => {
  it("always renders 4 slots: photos, uploads, then empty ones", () => {
    const slots = buildPhotoSlots([makePhoto(2), makePhoto(1)], [pending("b", 4), pending("a", 3)]);
    expect(slots.map((slot) => slot.kind)).toEqual(["photo", "photo", "pending", "pending"]);
    expect(slots[0]).toMatchObject({ kind: "photo", isMain: true, photo: { position: 1 } });
    expect(slots[1]).toMatchObject({ isMain: false });
    expect(slots[2]).toMatchObject({ pending: { key: "a" } });

    const empty = buildPhotoSlots([], []);
    expect(empty.map((slot) => slot.kind)).toEqual(["empty", "empty", "empty", "empty"]);
    expect(new Set(empty.map((slot) => slot.key)).size).toBe(4);
  });
});

describe("overallUploadProgress", () => {
  it("advances through the stages", () => {
    const preparing = overallUploadProgress("preparing");
    const halfway = overallUploadProgress("uploading", 0.5);
    const confirming = overallUploadProgress("confirming");
    expect(preparing).toBeLessThan(halfway);
    expect(halfway).toBeLessThan(confirming);
    expect(confirming).toBeLessThan(1);
    expect(overallUploadProgress("uploading", 7)).toBe(overallUploadProgress("uploading", 1));
  });
});
