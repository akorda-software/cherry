import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PhotoUploadIntent } from "@snack/contracts";

import { apiError, makePhoto } from "../../onboarding/testing/fixtures";
import { PhotoUploadError } from "../domain/photo-errors";
import { uploadBinaryWithFetch } from "../infrastructure/binary-upload";
import {
  knownMaxBytes,
  resetKnownMaxBytes,
  uploadProfilePhoto,
  type ImageCompressor,
  type PhotoUploadApi
} from "./upload-photo";

const INTENT: PhotoUploadIntent = {
  storageKey: "profiles/p/abc.jpg",
  uploadUrl: "http://localhost:4000/api/uploads/token-123",
  publicUrl: "http://localhost:4000/uploads/profiles/p/abc.jpg",
  method: "PUT",
  headers: { "Content-Type": "image/jpeg", "If-None-Match": "*" },
  expiresAt: "2026-09-29T12:10:00Z",
  maxBytes: 2_000_000
};

/** Respuesta mínima (jsdom tiene su propio Blob y el Response de Node no lo entiende). */
function fakeResponse(status: number, { blob, text = "" }: { blob?: Blob; text?: string } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: async () => blob ?? new Blob([text]),
    text: async () => text
  } as unknown as Response;
}

/** `fetch` de mentira: los `file://` devuelven un JPEG de `sizes[n]` bytes; los PUT, `putStatus`. */
function mockFetch({ sizes, putStatus = 200, putBody = "" }: { sizes: number[]; putStatus?: number; putBody?: string }) {
  let reads = 0;
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.startsWith("file://") || url.startsWith("blob:")) {
      const size = sizes[Math.min(reads, sizes.length - 1)];
      reads += 1;
      return fakeResponse(200, { blob: new Blob([new Uint8Array(size)], { type: "image/jpeg" }) });
    }

    return fakeResponse(putStatus, { text: putBody });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function fakeApi(overrides: Partial<PhotoUploadApi> = {}): PhotoUploadApi {
  return {
    createPhotoUploadIntent: vi.fn(async () => INTENT),
    completePhotoUpload: vi.fn(async (request) => makePhoto(request.position, { storageKey: request.storageKey })),
    ...overrides
  };
}

const compress: ImageCompressor = vi.fn(async (_image, attempt) => ({
  uri: `file:///compressed-${attempt.quality}.jpg`,
  width: 1080,
  height: 1440
}));

beforeEach(() => {
  resetKnownMaxBytes();
  vi.mocked(compress).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadProfilePhoto", () => {
  it("compresses, asks for the intent, PUTs the binary with ALL the headers and completes", async () => {
    const { calls } = mockFetch({ sizes: [345_000] });
    const api = fakeApi();
    const progress: string[] = [];

    const photo = await uploadProfilePhoto({
      api,
      image: { uri: "file:///original.heic", width: 4032, height: 3024 },
      position: 2,
      deps: { compress, upload: uploadBinaryWithFetch },
      onProgress: ({ stage }) => progress.push(stage)
    });

    expect(compress).toHaveBeenCalledWith(
      { uri: "file:///original.heic", width: 4032, height: 3024 },
      { quality: 0.8, maxLongSide: 1440 }
    );
    expect(api.createPhotoUploadIntent).toHaveBeenCalledWith({
      position: 2,
      contentType: "image/jpeg",
      sizeBytes: 345_000
    });

    const put = calls.find((call) => call.url === INTENT.uploadUrl);
    expect(put?.init?.method).toBe("PUT");
    expect(put?.init?.headers).toEqual({ "Content-Type": "image/jpeg", "If-None-Match": "*" });
    expect((put?.init?.body as Blob).size).toBe(345_000);

    expect(api.completePhotoUpload).toHaveBeenCalledWith({
      storageKey: INTENT.storageKey,
      publicUrl: INTENT.publicUrl,
      position: 2,
      contentType: "image/jpeg",
      sizeBytes: 345_000,
      width: 1080,
      height: 1440
    });
    expect(photo.position).toBe(2);
    expect(progress[0]).toBe("preparing");
    expect(progress).toContain("uploading");
    expect(progress[progress.length - 1]).toBe("confirming");
  });

  it("recompresses harder when the result is above the known limit", async () => {
    resetKnownMaxBytes(500_000);
    mockFetch({ sizes: [900_000, 640_000, 420_000] });
    const api = fakeApi();

    await uploadProfilePhoto({ api, image: { uri: "file:///big.jpg" }, position: 1, deps: { compress, upload: uploadBinaryWithFetch } });

    expect(compress).toHaveBeenCalledTimes(3);
    expect(vi.mocked(compress).mock.calls.map(([, attempt]) => attempt.quality)).toEqual([0.8, 0.68, 0.6]);
    expect(api.createPhotoUploadIntent).toHaveBeenCalledTimes(1);
    expect(api.createPhotoUploadIntent).toHaveBeenCalledWith(expect.objectContaining({ sizeBytes: 420_000 }));
  });

  it("retries with more compression when the intent rejects the size (422 errors.size_bytes)", async () => {
    mockFetch({ sizes: [1_900_000, 1_200_000] });
    const createPhotoUploadIntent = vi
      .fn()
      .mockRejectedValueOnce(apiError(422, { errors: { size_bytes: ["must be less than or equal to 1500000"] } }))
      .mockResolvedValueOnce({ ...INTENT, maxBytes: 1_500_000 });
    const api = fakeApi({ createPhotoUploadIntent });

    await uploadProfilePhoto({ api, image: { uri: "file:///x.jpg" }, position: 1, deps: { compress, upload: uploadBinaryWithFetch } });

    expect(createPhotoUploadIntent).toHaveBeenCalledTimes(2);
    expect(createPhotoUploadIntent).toHaveBeenLastCalledWith(expect.objectContaining({ sizeBytes: 1_200_000 }));
    // La siguiente foto ya apunta al límite real del servidor.
    expect(knownMaxBytes()).toBe(1_500_000);
  });

  it("gives up with too_large when not even the last step fits", async () => {
    resetKnownMaxBytes(100);
    mockFetch({ sizes: [5_000] });
    const api = fakeApi();

    const error = await uploadProfilePhoto({
      api,
      image: { uri: "file:///x.jpg" },
      position: 1,
      deps: { compress, upload: uploadBinaryWithFetch }
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PhotoUploadError);
    expect((error as PhotoUploadError).code).toBe("too_large");
    expect(api.createPhotoUploadIntent).not.toHaveBeenCalled();
  });

  it("maps storage_not_configured (503) from the intent", async () => {
    mockFetch({ sizes: [300_000] });
    const api = fakeApi({
      createPhotoUploadIntent: vi.fn(async () => {
        throw apiError(503, { error: "storage_not_configured" });
      })
    });

    await expect(
      uploadProfilePhoto({ api, image: { uri: "file:///x.jpg" }, position: 1, deps: { compress, upload: uploadBinaryWithFetch } })
    ).rejects.toMatchObject({ code: "storage_not_configured", status: 503 });
  });

  it("maps a failed PUT (413 upload_too_large) and never completes", async () => {
    mockFetch({ sizes: [300_000], putStatus: 413, putBody: JSON.stringify({ error: "upload_too_large" }) });
    const api = fakeApi();

    await expect(
      uploadProfilePhoto({ api, image: { uri: "file:///x.jpg" }, position: 1, deps: { compress, upload: uploadBinaryWithFetch } })
    ).rejects.toMatchObject({ code: "too_large" });
    expect(api.completePhotoUpload).not.toHaveBeenCalled();
  });

  it("maps 422 errors from complete (upload_invalid_image)", async () => {
    mockFetch({ sizes: [300_000] });
    const api = fakeApi({
      completePhotoUpload: vi.fn(async () => {
        throw apiError(422, { error: "upload_invalid_image" });
      })
    });

    await expect(
      uploadProfilePhoto({ api, image: { uri: "file:///x.jpg" }, position: 1, deps: { compress, upload: uploadBinaryWithFetch } })
    ).rejects.toMatchObject({ code: "invalid_image" });
  });

  it("reports processing failures when the image cannot be compressed", async () => {
    mockFetch({ sizes: [1] });
    const broken: ImageCompressor = vi.fn(async () => {
      throw new Error("decode failed");
    });

    await expect(
      uploadProfilePhoto({ api: fakeApi(), image: { uri: "file:///x.heic" }, position: 1, deps: { compress: broken } })
    ).rejects.toMatchObject({ code: "processing_failed" });
  });

  it("reports network errors on the PUT", async () => {
    mockFetch({ sizes: [300_000] });
    const offline = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });

    await expect(
      uploadProfilePhoto({ api: fakeApi(), image: { uri: "file:///x.jpg" }, position: 1, deps: { compress, upload: offline } })
    ).rejects.toMatchObject({ code: "network" });
  });
});
