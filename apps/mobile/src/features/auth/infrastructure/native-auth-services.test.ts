import Constants from "expo-constants";
import { Platform } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HttpClient } from "@cherry/mobile-shared";

import { assembleAuthServices } from "./auth-assembly";
import { createAppleBrowserAdapter } from "./apple-browser-adapter";
import { createAppleNativeAdapter } from "./apple-native-adapter";
import { createGoogleNativeAdapter } from "./google-native-adapter";
import { createNativeAuthServices } from "./native-auth-services";

vi.mock("./auth-assembly", () => ({ assembleAuthServices: vi.fn(() => ({})) }));
vi.mock("./apple-browser-adapter", () => ({
  createAppleBrowserAdapter: vi.fn(() => ({ signIn: vi.fn() }))
}));
vi.mock("./apple-native-adapter", () => ({
  createAppleNativeAdapter: vi.fn(() => ({ signIn: vi.fn() }))
}));
vi.mock("./google-native-adapter", () => ({
  createGoogleNativeAdapter: vi.fn(() => ({ signIn: vi.fn() }))
}));

const originalConfig = Constants.expoConfig;
const originalOS = Platform.OS;

afterEach(() => {
  Constants.expoConfig = originalConfig;
  Platform.OS = originalOS;
  vi.clearAllMocks();
});

describe("native auth service selection", () => {
  it.each([
    ["android", true, true],
    ["android", false, false],
    ["ios", true, false],
    ["ios", false, false]
  ] as const)("selects Apple adapter for %s, browser flag %s", (os, enabled, browser) => {
    Platform.OS = os;
    Constants.expoConfig = {
      ...originalConfig, name: "Synthetic", slug: "synthetic", scheme: "cherry-dev",
      extra: { appleBrowserEnabled: enabled }
    };
    const httpClient = {} as HttpClient;
    createNativeAuthServices({ httpClient, googleWebClientId: "synthetic-web", googleIosClientId: "synthetic-ios" });

    if (browser) {
      expect(createAppleBrowserAdapter).toHaveBeenCalledWith(expect.objectContaining({ httpClient, scheme: "cherry-dev" }));
      expect(createAppleNativeAdapter).not.toHaveBeenCalled();
    } else {
      expect(createAppleNativeAdapter).toHaveBeenCalledOnce();
      expect(createAppleBrowserAdapter).not.toHaveBeenCalled();
    }
    expect(createGoogleNativeAdapter).toHaveBeenCalledWith(expect.objectContaining({
      webClientId: "synthetic-web", iosClientId: "synthetic-ios"
    }));
    expect(assembleAuthServices).toHaveBeenCalledWith(expect.objectContaining({
      nativeApple: browser
        ? vi.mocked(createAppleBrowserAdapter).mock.results[0].value
        : vi.mocked(createAppleNativeAdapter).mock.results[0].value
    }));
  });
});
