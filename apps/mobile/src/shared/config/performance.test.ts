import { describe, expect, it } from "vitest";
import { activityPerformance, discoveryPerformance, imagePrefetchPerformance, networkPerformance } from "./performance";

describe("technical performance policy", () => {
  it("keeps operational defaults positive, finite and immutable", () => {
    for (const policy of [networkPerformance, activityPerformance, discoveryPerformance, imagePrefetchPerformance]) {
      expect(Object.isFrozen(policy)).toBe(true);
      for (const value of Object.values(policy)) {
        if (typeof value !== "number") continue;
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it("keeps coupled budgets coherent without changing product rules", () => {
    expect(networkPerformance.uploadTimeoutMs).toBeGreaterThan(networkPerformance.requestTimeoutMs);
    expect(activityPerformance.pollIntervalMs).toBeGreaterThan(activityPerformance.minRequestGapMs);
    expect(discoveryPerformance.prefetchThreshold).toBeLessThan(discoveryPerformance.pageSize);
    expect(discoveryPerformance.imageLookahead).toBeLessThanOrEqual(discoveryPerformance.pageSize);
    expect(discoveryPerformance.pageSize).toBeLessThanOrEqual(100);
    expect(imagePrefetchPerformance.maxEntries).toBeGreaterThan(discoveryPerformance.imageLookahead * 4);
  });
});
