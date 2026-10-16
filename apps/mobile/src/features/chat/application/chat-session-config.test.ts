import { describe, expect, it } from "vitest";
import * as policy from "./chat-session-config";

describe("realtime technical policy", () => {
  it("uses timer-safe positive integer delays and bounded message pages", () => {
    for (const [name, value] of Object.entries(policy)) {
      if (!name.endsWith("_MS") || typeof value !== "number") continue;
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(2_147_483_647);
    }
    expect(policy.CHAT_PAGE_SIZE).toBeLessThanOrEqual(100);
    expect(policy.MAX_AUTO_ATTEMPTS).toBeGreaterThan(0);
  });

  it("keeps reconnect/read retry policies bounded and separate from debounce", () => {
    expect(policy.MARK_READ_RETRY_INITIAL_MS).toBeGreaterThan(policy.MARK_READ_DEBOUNCE_MS);
    expect(policy.MARK_READ_RETRY_MAX_MS).toBeGreaterThanOrEqual(policy.MARK_READ_RETRY_INITIAL_MS);
    expect(policy.MARK_READ_RETRY_JITTER).toBeGreaterThanOrEqual(0);
    expect(policy.MARK_READ_RETRY_JITTER).toBeLessThan(1);
    expect(policy.SOCKET_RECONNECT_MAX_MS).toBeGreaterThanOrEqual(Math.max(...policy.SOCKET_RECONNECT_DELAYS_MS));
    expect(policy.CHANNEL_REJOIN_MAX_MS).toBeGreaterThanOrEqual(Math.max(...policy.CHANNEL_REJOIN_DELAYS_MS));
  });
});
