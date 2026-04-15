/**
 * Mock for expo-application in jsdom tests.
 */
export const applicationId = "app.snack.mobile.test";
export const applicationName = "Snack";
export const nativeApplicationVersion = "0.0.0";
export const nativeBuildVersion = "1";
export const installationId = "test-installation-id";
export const installationTimeAsync = vi.fn(() => Promise.resolve(0));
export const isInstalledFromAppStoreAsync = vi.fn(() => Promise.resolve(false));
