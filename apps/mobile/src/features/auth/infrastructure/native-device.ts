import type { DevicePlatform } from "@snack/contracts";

interface DeviceInfo {
  installationId: string;
  platform: DevicePlatform;
  deviceName: string;
}

interface NativeModules {
  getInstallationId(): Promise<string>;
  getPlatform(): DevicePlatform;
  getDeviceName(): Promise<string>;
}

export function createNativeDevice(modules: NativeModules) {
  return {
    async getDevice(): Promise<DeviceInfo> {
      const [installationId, deviceName] = await Promise.all([
        modules.getInstallationId(),
        modules.getDeviceName()
      ]);

      return {
        installationId,
        platform: modules.getPlatform(),
        deviceName
      };
    }
  };
}
