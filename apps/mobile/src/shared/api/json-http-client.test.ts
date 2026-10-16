import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createJsonHttpClient, friendlyErrorMessage, withRequestTimeout } from "./index";

const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.useRealTimers();
});

/** `fetch` que no responde nunca, salvo que se aborte su señal. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
  );
}

describe("createJsonHttpClient · tiempo máximo", () => {
  it("forwards cancellation, settles even if work ignores it, and detaches its listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    let signal!: AbortSignal;
    const pending = withRequestTimeout((requestSignal) => {
      signal = requestSignal;
      return new Promise(() => {});
    }, 500, controller.signal);
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await assertion;
    expect(signal.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("detaches external cancellation after successful completion", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    let signal!: AbortSignal;
    await expect(withRequestTimeout(async (requestSignal) => {
      signal = requestSignal;
      return "ok";
    }, 500, controller.signal)).resolves.toBe("ok");
    controller.abort();
    expect(signal.aborted).toBe(false);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects synchronous work errors without leaving a timeout behind", async () => {
    const error = new Error("client unavailable");
    let pending!: Promise<unknown>;
    expect(() => {
      pending = withRequestTimeout(() => { throw error; }, 500);
    }).not.toThrow();
    await expect(pending).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, Infinity, NaN, 2_147_483_648])("rejects invalid timeout %s before starting work", async (timeoutMs) => {
    const run = vi.fn(async () => "ok");
    await expect(withRequestTimeout(run, timeoutMs)).rejects.toBeInstanceOf(RangeError);
    expect(run).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("removes timers on success and preserves non-timeout rejection identity", async () => {
    await expect(withRequestTimeout(async () => "ok", 500)).resolves.toBe("ok");
    const error = Object.assign(new Error("invalid"), { status: 422 });
    await expect(withRequestTimeout(async () => { throw error; }, 500)).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("also covers a response whose body never finishes", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) })) as unknown as typeof fetch;
    const pending = createJsonHttpClient({ apiBaseUrl: "http://api", timeoutMs: 500 }).get("/x");
    const assertion = expect(pending).rejects.toMatchObject({ timedOut: true });
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a hanging request and fails as a transient network error", async () => {
    const fetchMock = hangingFetch();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const client = createJsonHttpClient({ apiBaseUrl: "http://api", timeoutMs: 1_000 });

    const pending = client.get("/api/me/summary");
    const assertion = expect(pending).rejects.toBeInstanceOf(TypeError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    const signal = fetchMock.mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(true);
    await pending.catch((error: unknown) => {
      expect(friendlyErrorMessage(error)).toMatch(/no hay conexión/);
    });
  });

  it("keeps API errors as they are", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "invalid_cursor" }), { status: 422 })
    ) as unknown as typeof fetch;
    const client = createJsonHttpClient({ apiBaseUrl: "http://api" });

    await expect(client.get("/x")).rejects.toMatchObject({ status: 422, code: "invalid_cursor" });
  });

  it("times out even when the work ignores the abort signal", async () => {
    const pending = withRequestTimeout(() => new Promise<never>(() => undefined), 500);
    const assertion = expect(pending).rejects.toMatchObject({ timedOut: true });
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
