import { afterEach, describe, expect, it, vi } from "vitest";

import { binaryUploadHttpError, readUriAsBlob, uploadBinaryWithXhr } from "./binary-upload";

/** XHR mínimo controlable desde el test. */
class FakeXhr {
  static last: FakeXhr | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  status = 0;
  responseText = "";
  timeout = 0;
  body: unknown;
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  abort() {
    this.onabort?.();
  }

  respond(status: number, text = "") {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeXhr.last = null;
});

describe("uploadBinaryWithXhr", () => {
  it("sends every header, reports progress and resolves on 2xx", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const progress: number[] = [];
    const body = new Blob([new Uint8Array(10)]);

    const promise = uploadBinaryWithXhr({
      url: "http://up/token",
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "If-None-Match": "*", "x-amz-meta-profile": "p1" },
      body,
      onProgress: (fraction) => progress.push(fraction)
    });

    const xhr = FakeXhr.last!;
    expect(xhr.method).toBe("PUT");
    expect(xhr.headers).toEqual({ "Content-Type": "image/jpeg", "If-None-Match": "*", "x-amz-meta-profile": "p1" });
    expect(xhr.body).toBe(body);

    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    xhr.respond(200, '{"ok":true}');

    await expect(promise).resolves.toBeUndefined();
    expect(progress).toEqual([0, 0.5, 1]);
  });

  it("rejects with the backend code on HTTP errors", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = uploadBinaryWithXhr({ url: "http://up/t", method: "PUT", headers: {}, body: new Blob(["x"]) });
    FakeXhr.last!.respond(413, JSON.stringify({ error: "upload_too_large" }));
    await expect(promise).rejects.toMatchObject({ status: 413, code: "upload_too_large" });
  });

  it("rejects with a TypeError on network errors (mapped to «sin conexión»)", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const promise = uploadBinaryWithXhr({ url: "http://up/t", method: "PUT", headers: {}, body: new Blob(["x"]) });
    FakeXhr.last!.onerror?.();
    await expect(promise).rejects.toBeInstanceOf(TypeError);
  });

  it("aborts with the signal", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();
    const promise = uploadBinaryWithXhr({
      url: "http://up/t",
      method: "PUT",
      headers: {},
      body: new Blob(["x"]),
      signal: controller.signal
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("helpers", () => {
  it("parses non-JSON error bodies gracefully", () => {
    expect(binaryUploadHttpError(502, "<html>bad gateway</html>")).toMatchObject({ status: 502, code: undefined });
  });

  it("reads a local uri as a Blob through fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob([new Uint8Array(42)]) }))
    );
    const blob = await readUriAsBlob("file:///photo.jpg");
    expect(blob.size).toBe(42);
  });
});
