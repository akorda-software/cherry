import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MARK_READ_DEBOUNCE_MS, MARK_READ_RETRY_INITIAL_MS } from "./chat-session-config";
import { createReadReceiptController } from "./read-receipt-controller";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

function setup(send = vi.fn(async () => {})) {
  let enabled = true;
  const onRead = vi.fn();
  const onError = vi.fn(() => false);
  const receipts = createReadReceiptController({
    send, canSend: () => enabled, onRead, onError, random: () => 0.5
  });
  return { receipts, send, onRead, onError, enable: (value: boolean) => { enabled = value; } };
}

describe("read receipt controller", () => {
  it("waits for visibility and coalesces requests without losing the pending receipt", async () => {
    const ctx = setup();
    ctx.enable(false);
    ctx.receipts.request();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(ctx.send).not.toHaveBeenCalled();
    ctx.enable(true);
    ctx.receipts.schedule(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.send).toHaveBeenCalledOnce();
    expect(ctx.onRead).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("deduplicates requests while one is in flight and sends one catch-up afterward", async () => {
    const response = deferred();
    const send = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(undefined);
    const { receipts } = setup(send);
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    receipts.request();
    receipts.request();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(send).toHaveBeenCalledOnce();
    response.resolve();
    await vi.advanceTimersByTimeAsync(MARK_READ_DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("backs off to six attempts per simulated minute instead of 151 on fast failures", async () => {
    const send = vi.fn(async () => { throw new TypeError("offline"); });
    const { receipts } = setup(send);
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledTimes(6);
    receipts.dispose();
  });

  it("does not let incoming messages or repeated visibility triggers bypass retry backoff", async () => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(undefined);
    const { receipts } = setup(send);
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    receipts.request();
    await vi.advanceTimersByTimeAsync(500);
    receipts.schedule(0);
    await vi.advanceTimersByTimeAsync(MARK_READ_RETRY_INITIAL_MS - 501);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("cancels scheduled work while hidden and retries when visible again", async () => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(undefined);
    const ctx = setup(send);
    ctx.receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    ctx.enable(false);
    ctx.receipts.cancel();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(send).toHaveBeenCalledOnce();
    ctx.enable(true);
    ctx.receipts.schedule(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stops on terminal failures", async () => {
    const ctx = setup(vi.fn(async () => { throw new Error("not_participant"); }));
    ctx.onError.mockReturnValue(true);
    ctx.receipts.request(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ctx.send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never resurrects a receipt acknowledged by sending a message when an old read fails", async () => {
    const response = deferred();
    const send = vi.fn(() => response.promise);
    const { receipts } = setup(send);
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    receipts.acknowledge();
    response.reject(new TypeError("old read failed"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves messages arriving after that acknowledgement even if the old read fails", async () => {
    const response = deferred();
    const send = vi.fn().mockReturnValueOnce(response.promise).mockResolvedValue(undefined);
    const { receipts } = setup(send);
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    receipts.acknowledge();
    receipts.request();
    response.reject(new TypeError("old read failed"));
    await vi.advanceTimersByTimeAsync(MARK_READ_DEBOUNCE_MS);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("ignores late completion after disposal and clears its timers", async () => {
    const response = deferred();
    const ctx = setup(vi.fn(() => response.promise));
    ctx.receipts.request(0);
    await vi.advanceTimersByTimeAsync(0);
    ctx.receipts.dispose();
    response.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
    ctx.receipts.request(0);
    expect(ctx.onRead).not.toHaveBeenCalled();
    expect(ctx.send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([[0, 1_200], [1, 1_800]])("jitters retries without removing the minimum delay (%s)", async (random, delay) => {
    const send = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(undefined);
    const receipts = createReadReceiptController({ send, canSend: () => true, random: () => random });
    receipts.request(0);
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
