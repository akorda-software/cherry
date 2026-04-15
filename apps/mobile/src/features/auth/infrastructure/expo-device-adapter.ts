import { createNativeDevice } from "./native-device";

/**
 * Creates a device adapter using direct getter functions.
 * In the native app, these are wired to expo-application / expo-device / expo-constants.
 */
export function createDeviceAdapter(getters: {
  getInstallationId(): Promise<string>;
  getDeviceName(): Promise<string>;
  getPlatform(): "ios" | "android";
}) {
  return createNativeDevice({
    getInstallationId: getters.getInstallationId,
    getPlatform: getters.getPlatform,
    getDeviceName: getters.getDeviceName
  });
}
