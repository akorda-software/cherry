import { describe, expect, it } from "vitest";

import { createNativeDevice } from "./native-device";

describe("createNativeDevice", () => {
  it("returns device info from native modules", async () => {
    const device = createNativeDevice({
      getInstallationId: async () => "install-123",
      getPlatform: () => "android",
      getDeviceName: async () => "Pixel 9"
    });

    await expect(device.getDevice()).resolves.toEqual({
      installationId: "install-123",
      platform: "android",
      deviceName: "Pixel 9"
    });
  });

  it("fetches installationId and deviceName concurrently", async () => {
    const callOrder: string[] = [];
    const device = createNativeDevice({
      getInstallationId: async () => {
        callOrder.push("installationId");
        return "install-456";
      },
      getPlatform: () => {
        callOrder.push("platform");
        return "ios";
      },
      getDeviceName: async () => {
        callOrder.push("deviceName");
        return "iPhone 16";
      }
    });

    const result = await device.getDevice();

    expect(result).toEqual({
      installationId: "install-456",
      platform: "ios",
      deviceName: "iPhone 16"
    });

    // Both async calls should be initiated (platform is sync)
    expect(callOrder).toContain("installationId");
    expect(callOrder).toContain("deviceName");
  });
});
