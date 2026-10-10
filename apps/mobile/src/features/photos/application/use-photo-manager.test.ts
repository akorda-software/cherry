import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfilePhoto } from "@cherry/contracts";

import { apiError, makePhoto } from "../../onboarding/testing/fixtures";
import type { PickPhotosResult } from "../infrastructure/image-picker";
import { resetKnownMaxBytes } from "./upload-photo";
import { usePhotoManager, type PhotoManagerApi } from "./use-photo-manager";

function setup({
  photos = [] as ProfilePhoto[],
  mode = "onboarding" as const,
  api: overrides = {} as Partial<PhotoManagerApi>,
  pick = vi.fn(async (): Promise<PickPhotosResult> => ({ status: "canceled" }))
} = {}) {
  let nextId = 100;
  const api: PhotoManagerApi = {
    listPhotos: vi.fn(async () => photos),
    createPhotoUploadIntent: vi.fn(async (request) => ({
      storageKey: `profiles/p/${request.position}.jpg`,
      uploadUrl: "http://localhost:4000/api/uploads/t",
      publicUrl: `http://localhost:4000/uploads/profiles/p/${request.position}.jpg`,
      method: "PUT" as const,
      headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
      expiresAt: "2026-09-29T12:10:00Z",
      maxBytes: 2_000_000
    })),
    completePhotoUpload: vi.fn(async (request) => makePhoto(request.position, { id: `new-${(nextId += 1)}` })),
    deletePhoto: vi.fn(async () => undefined),
    reorderPhotos: vi.fn(async (ids: string[]) =>
      ids.map((id, index) => ({ ...(photos.find((photo) => photo.id === id) ?? makePhoto(index + 1)), id, position: index + 1 }))
    ),
    ...overrides
  };
  const onPhotosChange = vi.fn();
  const upload = vi.fn(async () => undefined);
  const compress = vi.fn(async (image: { uri: string }) => ({ uri: image.uri, width: 1080, height: 1440 }));
  const readBlob = vi.fn(async () => new Blob([new Uint8Array(1234)]));
  let keys = 0;

  const hook = renderHook(() =>
    usePhotoManager({
      api,
      mode,
      initialPhotos: photos,
      pick,
      compress,
      upload,
      readBlob,
      onPhotosChange,
      createKey: () => `k${(keys += 1)}`
    })
  );

  return { ...hook, api, onPhotosChange, upload, pick };
}

beforeEach(() => resetKnownMaxBytes());
afterEach(() => vi.restoreAllMocks());

describe("usePhotoManager", () => {
  it("starts from the saved photos and cannot continue with fewer than 2", () => {
    const { result } = setup({ photos: [makePhoto(1)] });
    expect(result.current.uploadedCount).toBe(1);
    expect(result.current.canContinue).toBe(false);
    expect(result.current.slots.map((slot) => slot.kind)).toEqual(["photo", "empty", "empty", "empty"]);
  });

  it("uploads several picked images in parallel into free positions", async () => {
    const pick = vi.fn(
      async (): Promise<PickPhotosResult> => ({
        status: "picked",
        images: [{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }]
      })
    );
    const { result, api, onPhotosChange } = setup({ photos: [makePhoto(1)], pick });

    await act(async () => {
      await result.current.add("library");
    });

    expect(pick).toHaveBeenCalledWith("library", 3);
    await waitFor(() => expect(result.current.uploadedCount).toBe(3));
    expect(vi.mocked(api.createPhotoUploadIntent).mock.calls.map(([request]) => request.position).sort()).toEqual([2, 3]);
    expect(result.current.pending).toEqual([]);
    expect(result.current.canContinue).toBe(true);
    expect(onPhotosChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ position: 3 })]));
  });

  it("keeps a failed upload in its slot with a friendly error and retries it", async () => {
    const createPhotoUploadIntent = vi
      .fn()
      .mockRejectedValueOnce(apiError(503, { error: "storage_unavailable" }))
      .mockResolvedValue({
        storageKey: "profiles/p/1.jpg",
        uploadUrl: "http://x/t",
        publicUrl: "http://x/p.jpg",
        method: "PUT",
        headers: {},
        expiresAt: "2026-09-29T12:10:00Z",
        maxBytes: 2_000_000
      });
    const { result } = setup({ api: { createPhotoUploadIntent } });

    act(() => result.current.addImages([{ uri: "file:///a.jpg" }]));
    await waitFor(() => expect(result.current.pending[0]?.error).toMatch(/no responde/));
    expect(result.current.uploading).toBe(false);
    expect(result.current.slots[0].kind).toBe("pending");

    act(() => result.current.retry("k1"));
    await waitFor(() => expect(result.current.uploadedCount).toBe(1));
    expect(result.current.pending).toEqual([]);
  });

  it("explains storage_not_configured kindly", async () => {
    const { result } = setup({
      api: {
        createPhotoUploadIntent: vi.fn(async () => {
          throw apiError(503, { error: "storage_not_configured" });
        })
      }
    });
    act(() => result.current.addImages([{ uri: "file:///a.jpg" }]));
    await waitFor(() => expect(result.current.pending[0]?.error).toMatch(/aún no puede guardar fotos/));
  });

  it("discards a failed upload", async () => {
    const { result } = setup({
      api: {
        createPhotoUploadIntent: vi.fn(async () => {
          throw apiError(422, { error: "too_many_photos" });
        })
      }
    });
    act(() => result.current.addImages([{ uri: "file:///a.jpg" }]));
    await waitFor(() => expect(result.current.pending[0]?.error).toBeTruthy());
    act(() => result.current.discard("k1"));
    expect(result.current.pending).toEqual([]);
  });

  it("does not go over 4 photos", async () => {
    const photos = [makePhoto(1), makePhoto(2), makePhoto(3)];
    const { result } = setup({ photos });
    act(() => result.current.addImages([{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }]));
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.notice?.message).toMatch(/Ya tienes 4 fotos/);
    await waitFor(() => expect(result.current.uploadedCount).toBe(4));
    expect(result.current.canAdd).toBe(false);
  });

  it("deletes photos, but never below 2 in edit mode", async () => {
    const photos = [makePhoto(1), makePhoto(2)];
    const edit = setup({ photos, mode: "edit" as never });
    expect(edit.result.current.canRemove("photo-1")).toBe(false);
    let removed = true;
    await act(async () => {
      removed = await edit.result.current.remove("photo-1");
    });
    expect(removed).toBe(false);
    expect(edit.api.deletePhoto).not.toHaveBeenCalled();
    expect(edit.result.current.notice?.message).toMatch(/al menos 2 fotos/);

    const onboarding = setup({ photos });
    await act(async () => {
      await onboarding.result.current.remove("photo-1");
    });
    expect(onboarding.api.deletePhoto).toHaveBeenCalledWith("photo-1");
    expect(onboarding.result.current.photos.map((photo) => photo.id)).toEqual(["photo-2"]);
  });

  it("makes a photo the main one (optimistic, confirmed by PUT order)", async () => {
    const photos = [makePhoto(1), makePhoto(2), makePhoto(3)];
    const { result, api } = setup({ photos });

    await act(async () => {
      await result.current.makeMain("photo-3");
    });

    expect(api.reorderPhotos).toHaveBeenCalledWith(["photo-3", "photo-1", "photo-2"]);
    expect(result.current.photos[0].id).toBe("photo-3");
    expect(result.current.slots[0]).toMatchObject({ kind: "photo", isMain: true, photo: { id: "photo-3" } });
  });

  it("rolls back the main photo when the reorder fails", async () => {
    const photos = [makePhoto(1), makePhoto(2)];
    const { result } = setup({
      photos,
      api: {
        reorderPhotos: vi.fn(async () => {
          throw apiError(500, {});
        })
      }
    });

    await act(async () => {
      await result.current.makeMain("photo-2");
    });

    expect(result.current.photos.map((photo) => photo.id)).toEqual(["photo-1", "photo-2"]);
    expect(result.current.notice?.message).toMatch(/por nuestra parte/);
  });

  it("tells how to recover when the camera permission is blocked", async () => {
    const pick = vi.fn(async (): Promise<PickPhotosResult> => ({ status: "permission_denied", canAskAgain: false }));
    const { result } = setup({ pick });
    await act(async () => {
      await result.current.add("camera");
    });
    expect(result.current.notice).toEqual({ message: expect.stringMatching(/Ajustes/), action: "settings" });
  });
});
