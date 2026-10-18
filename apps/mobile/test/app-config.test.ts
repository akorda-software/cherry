import { describe, expect, it, vi } from "vitest";

vi.mock("expo/config-plugins", () => ({
  withAndroidManifest: (config: unknown, callback: (value: unknown) => unknown) => callback(config)
}));

import { withCleartextForHttpBackend } from "../app.config";

describe("Android cleartext configuration", () => {
  it.each(["https://cherry.example", undefined])("removes stale development HTTP permission for %s", (url) => {
    const application = { $: { "android:usesCleartextTraffic": "true" } };
    withCleartextForHttpBackend({ modResults: { manifest: { application: [application] } } } as never, url);
    expect(application.$["android:usesCleartextTraffic"]).toBe("false");
  });

  it("allows an explicitly configured local HTTP backend", () => {
    const application = { $: { "android:usesCleartextTraffic": "false" } };
    withCleartextForHttpBackend({ modResults: { manifest: { application: [application] } } } as never, "http://192.0.2.1:4000");
    expect(application.$["android:usesCleartextTraffic"]).toBe("true");
  });
});
