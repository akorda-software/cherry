import { describe, expect, it } from "vitest";

import { createDeviceAdapter } from "./expo-device-adapter";

describe("createDeviceAdapter", () => {
  it("delegates to createNativeDevice with getter results", async () => {
    const adapter = createDeviceAdapter({
      getInstallationId: async () => "expo-install-789",
      getDeviceName: async () => "Expo Test Device",
      getPlatform: () => "android"
    });

    const result = await adapter.getDevice();

    expect(result).toEqual({
      installationId: "expo-install-789",
      platform: "android",
      deviceName: "Expo Test Device"
    });
  });

  it("supports iOS platform", async () => {
    const adapter = createDeviceAdapter({
      getInstallationId: async () => "idfv-uuid",
      getDeviceName: async () => "iPhone Simulator",
      getPlatform: () => "ios"
    });

    const result = await adapter.getDevice();

    expect(result.platform).toBe("ios");
  });
});
