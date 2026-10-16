import { describe, expect, it, vi } from "vitest";

import {
  createImagePrefetcher,
  IMAGE_PREFETCH_MAX_ENTRIES,
  IMAGE_PREFETCH_REUSE_MS,
  prefetchImageUrls
} from "./image-prefetch";

const { nativePrefetch } = vi.hoisted(() => ({ nativePrefetch: vi.fn(async () => true) }));
vi.mock("expo-image", () => ({ Image: { prefetch: nativePrefetch } }));

describe("shared image prefetch", () => {
  it("deduplicates empty, repeated and overlapping URLs before calling native code", async () => {
    const native = vi.fn(async () => true);
    const prefetch = createImagePrefetcher(native);
    const urls = Object.freeze(["a", "a", "", " ", "b"]);
    prefetch(urls);
    prefetch(["b", "a", "c"]);
    prefetch(["a", "b", "c"]);
    expect(native).toHaveBeenCalledTimes(2);
    expect(native).toHaveBeenNthCalledWith(1, ["a", "b"]);
    expect(native).toHaveBeenNthCalledWith(2, ["c"]);
    await Promise.resolve();
    prefetch(["a", "b", "c"]);
    expect(native).toHaveBeenCalledTimes(2);
  });

  it("allows retry after false, rejection or a synchronous failure", async () => {
    const native = vi.fn()
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => { throw new Error("native unavailable"); })
      .mockResolvedValue(true);
    const prefetch = createImagePrefetcher(native);
    for (let i = 0; i < 4; i += 1) {
      expect(() => prefetch(["a"])).not.toThrow();
      await Promise.resolve();
    }
    expect(native).toHaveBeenCalledTimes(4);
    prefetch(["a"]);
    expect(native).toHaveBeenCalledTimes(4);
  });

  it("expires metadata even if callers keep asking for the same URL", () => {
    let now = 0;
    const native = vi.fn(async () => true);
    const prefetch = createImagePrefetcher(native, () => now);
    prefetch(["a"]);
    now = IMAGE_PREFETCH_REUSE_MS - 1;
    prefetch(["a"]);
    now += 1;
    prefetch(["a"]);
    expect(native).toHaveBeenCalledTimes(2);
  });

  it("bounds metadata with LRU eviction rather than growing for the whole session", () => {
    const native = vi.fn(async () => true);
    const prefetch = createImagePrefetcher(native);
    for (let i = 0; i < IMAGE_PREFETCH_MAX_ENTRIES; i += 1) prefetch([`photo-${i}`]);
    prefetch(["photo-0"]); // Touch the oldest entry so it survives the next eviction.
    prefetch(["new-photo"]);
    prefetch(["photo-0"]);
    expect(native).toHaveBeenCalledTimes(IMAGE_PREFETCH_MAX_ENTRIES + 1);
    prefetch(["photo-1"]);
    expect(native).toHaveBeenCalledTimes(IMAGE_PREFETCH_MAX_ENTRIES + 2);
  });

  it("does not let an old failure forget a newer in-flight prefetch", async () => {
    let now = 0;
    let reject!: (error: unknown) => void;
    const old = new Promise<boolean>((_resolve, fail) => { reject = fail; });
    const native = vi.fn().mockReturnValueOnce(old).mockResolvedValue(true);
    const prefetch = createImagePrefetcher(native, () => now);
    prefetch(["a"]);
    now = IMAGE_PREFETCH_REUSE_MS;
    prefetch(["a"]);
    reject(new Error("old failure"));
    await Promise.resolve();
    prefetch(["a"]);
    expect(native).toHaveBeenCalledTimes(2);
  });

  it("keeps the adapter's existing memory-disk policy and shares native calls", () => {
    prefetchImageUrls(["https://images.example.test/a", "https://images.example.test/b"]);
    prefetchImageUrls(["https://images.example.test/b"]);
    expect(nativePrefetch).toHaveBeenCalledExactlyOnceWith(
      ["https://images.example.test/a", "https://images.example.test/b"], "memory-disk"
    );
  });
});
