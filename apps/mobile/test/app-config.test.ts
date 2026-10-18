import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo/config-plugins", () => ({
  withAndroidManifest: (config: Record<string, unknown>, callback: (value: unknown) => unknown) =>
    callback({ modResults: { manifest: { application: [{ $: {} }] } }, ...config })
}));

import createAppConfig, { withCleartextForHttpBackend } from "../app.config";

afterEach(() => vi.unstubAllEnvs());

describe("installed app name", () => {
  it("defaults to Cherry independently of the OpenCherry store title", () => {
    vi.stubEnv("EXPO_APP_NAME", undefined);
    expect(createAppConfig().name).toBe("Cherry");
  });

  it("keeps the explicit Cherry Dev name and its separate identity", () => {
    vi.stubEnv("EXPO_APP_NAME", "Cherry Dev");
    vi.stubEnv("EXPO_ANDROID_PACKAGE", "app.cherry.mobile.dev");
    vi.stubEnv("EXPO_IOS_BUNDLE_IDENTIFIER", "app.cherry.mobile.dev");
    vi.stubEnv("EXPO_APP_SCHEME", "cherry-dev");
    const config = createAppConfig();
    expect(config.name).toBe("Cherry Dev");
    expect(config.android?.package).toBe("app.cherry.mobile.dev");
    expect(config.ios?.bundleIdentifier).toBe("app.cherry.mobile.dev");
    expect(config.scheme).toBe("cherry-dev");
  });
});

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
