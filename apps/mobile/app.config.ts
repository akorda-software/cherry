import type { ExpoConfig } from "expo/config";

function readOptionalEnv(name: string): string | undefined {
  const value = process.env[name];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export default (): ExpoConfig => {
  const googleIosUrlScheme = readOptionalEnv("GOOGLE_IOS_URL_SCHEME");

  return {
    name: readOptionalEnv("EXPO_APP_NAME") ?? "Snack",
    slug: readOptionalEnv("EXPO_APP_SLUG") ?? "snack",
    scheme: readOptionalEnv("EXPO_APP_SCHEME") ?? "snack",
    version: "0.0.0",
    platforms: ["android", "ios", "web"],
    android: {
      package: readOptionalEnv("EXPO_ANDROID_PACKAGE") ?? "app.snack.mobile"
    },
    ios: {
      bundleIdentifier: readOptionalEnv("EXPO_IOS_BUNDLE_IDENTIFIER") ?? "app.snack.mobile"
    },
    plugins: [
      ...(googleIosUrlScheme
        ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }] as const]
        : []),
      ["expo-apple-authentication"],
      "expo-secure-store"
    ],
    extra: {
      apiBaseUrlAndroid: readOptionalEnv("EXPO_PUBLIC_API_BASE_URL_ANDROID"),
      apiBaseUrlIos: readOptionalEnv("EXPO_PUBLIC_API_BASE_URL_IOS"),
      apiBaseUrlWeb: readOptionalEnv("EXPO_PUBLIC_API_BASE_URL_WEB"),
      googleWebClientId: readOptionalEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
      googleIosClientId: readOptionalEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID")
    }
  };
};
