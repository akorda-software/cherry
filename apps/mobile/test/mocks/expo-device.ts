/**
 * Mock for expo-device in jsdom tests.
 */
export const brand = "Test";
export const manufacturer = "Test";
export const modelName = "Test Device";
export const deviceName = "Test Device";
export const modelId = "test-model";
export const deviceType = 2; // DeviceType.PHONE
export const isDevice = false;
export const supportedPlatformApiVersion = 54;
export const totalMemory = 4096;
export const osName = "web";
export const osVersion = "1.0";
export const osBuildId = "test";
export const osInternalBuildId = "test";
export const platformApiLevel = 0;
export const getDeviceNameAsync = vi.fn(() => Promise.resolve("Test Device"));
export const getDeviceTypeAsync = vi.fn(() => Promise.resolve(2));
export const getMaxMemoryAsync = vi.fn(() => Promise.resolve(4096));
export const isSideLoadingEnabledAsync = vi.fn(() => Promise.resolve(false));
export const supportedPlatformApiVersionAsync = vi.fn(() => Promise.resolve(54));
