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
    userInterfaceStyle: "light",
    backgroundColor: "#FFF6FB",
    icon: "./assets/images/icon.png",
    android: {
      package: readOptionalEnv("EXPO_ANDROID_PACKAGE") ?? "app.snack.mobile",
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundImage: "./assets/images/adaptive-icon-background.png",
        backgroundColor: "#C3B1FF",
        monochromeImage: "./assets/images/adaptive-icon-monochrome.png"
      }
    },
    web: {
      favicon: "./assets/images/favicon.png"
    },
    ios: {
      bundleIdentifier: readOptionalEnv("EXPO_IOS_BUNDLE_IDENTIFIER") ?? "app.snack.mobile"
    },
    plugins: [
      ...(googleIosUrlScheme
        ? [["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme }] as [string, any]]
        : []),
      ["expo-apple-authentication"],
      "expo-secure-store",
      "expo-font",
      [
        "expo-image-picker",
        {
          photosPermission: "Snack necesita acceso a tus fotos para que puedas añadirlas a tu perfil.",
          cameraPermission: "Snack usa la cámara solo si quieres hacerte una foto para tu perfil.",
          // Solo imágenes (mediaTypes: ["images"]): sin NSMicrophoneUsageDescription ni RECORD_AUDIO.
          microphonePermission: false
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Snack usa tu ubicación aproximada (redondeada a 500 m) para enseñarte gente cerca. Nunca compartimos tu ubicación exacta.",
          // Solo primer plano (requestForegroundPermissionsAsync): sin claves "Always" con texto en inglés por defecto.
          locationAlwaysAndWhenInUsePermission: false,
          locationAlwaysPermission: false
        }
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 220,
          backgroundColor: "#FFF6FB",
          resizeMode: "contain"
        }
      ]
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
