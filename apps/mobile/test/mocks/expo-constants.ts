/**
 * Mock for expo-constants in jsdom tests.
 */
export const installationId = "test-installation-constants";
export const session = {};
export const platform = {};
export const isLayoutAnimationExperimental = false;
export const expoConfig = {
  extra: {
    googleWebClientId: "test-google-web-client-id"
  }
};

export default {
  installationId,
  session,
  platform,
  isLayoutAnimationExperimental,
  expoConfig
};
