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
