/** Build-time technical policy. Product limits and server-authoritative rules stay in their domains. */
export const networkPerformance = Object.freeze({
  requestTimeoutMs: 20_000,
  uploadTimeoutMs: 120_000
});

export const activityPerformance = Object.freeze({
  pollIntervalMs: 45_000,
  minRequestGapMs: 2_000
});

export const discoveryPerformance = Object.freeze({
  pageSize: 20,
  prefetchThreshold: 5,
  imageLookahead: 6,
  maxEmptyPagesInARow: 3
});

export const imagePrefetchPerformance = Object.freeze({
  reuseMs: 30_000,
  maxEntries: 128,
  cachePolicy: "memory-disk" as const
});
