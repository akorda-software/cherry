import { Image } from "expo-image";
import { imagePrefetchPerformance } from "../config/performance";

/** Metadata only: native memory/disk caching remains owned by expo-image. */
export const IMAGE_PREFETCH_REUSE_MS = imagePrefetchPerformance.reuseMs;
export const IMAGE_PREFETCH_MAX_ENTRIES = imagePrefetchPerformance.maxEntries;

/** Share overlapping preloads without retaining every photo viewed during the session. */
export function createImagePrefetcher(
  prefetch: (urls: string[]) => Promise<boolean>,
  now: () => number = Date.now
): (urls: readonly string[]) => void {
  const recent = new Map<string, { at: number }>();

  return (urls) => {
    const requestedAt = now();
    const entry = { at: requestedAt };
    const wanted: string[] = [];

    for (const url of urls) {
      if (typeof url !== "string" || url.trim() === "") continue;
      const previous = recent.get(url);
      const age = previous ? requestedAt - previous.at : Infinity;
      if (previous && age >= 0 && age < IMAGE_PREFETCH_REUSE_MS) {
        // Bounded LRU, but hits do not extend the TTL: native caches may evict bitmaps.
        recent.delete(url);
        recent.set(url, previous);
        continue;
      }
      recent.delete(url);
      recent.set(url, entry);
      wanted.push(url);
    }

    while (recent.size > IMAGE_PREFETCH_MAX_ENTRIES) {
      recent.delete(recent.keys().next().value!);
    }
    if (wanted.length === 0) return;

    const retryable = () => {
      for (const url of wanted) {
        if (recent.get(url) === entry) recent.delete(url);
      }
    };

    try {
      // expo-image may resolve false for the whole batch when just one image fails.
      void prefetch(wanted).then((success) => { if (!success) retryable(); }, retryable);
    } catch {
      retryable();
    }
  };
}

const sharedPrefetch = createImagePrefetcher((urls) => Image.prefetch(urls, imagePrefetchPerformance.cachePolicy));

/** Silent optimization shared by discovery, feed scrolling and profile carousels. */
export function prefetchImageUrls(urls: readonly string[]): void {
  if (typeof Image.prefetch === "function") sharedPrefetch(urls);
}
