import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";

import { createAuthApi, createSessionApi, type HttpClient } from "@snack/mobile-shared";
import { createSecureSessionStorage } from "@snack/mobile-shared";
import { createGoogleNativeAdapter } from "../infrastructure/google-native-adapter";
import { createAppleNativeAdapter } from "../infrastructure/apple-native-adapter";
import { assembleAuthServices } from "../infrastructure/auth-assembly";
import type { SessionShellServices } from "../presentation";
import type { DevicePlatform } from "@snack/contracts";

interface CreateNativeAuthServicesOptions {
  httpClient: HttpClient;
  apiBaseUrl?: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
}

function getInstallationId(): string {
  // expo-application exposes platform-specific IDs
  // On Android: getAndroidId() returns ANDROID_ID
  // On iOS: getIosIdForVendorAsync() returns IDFV (async)
  // For a synchronous fallback, use Constants.expoConfig?.extra or a UUID
  const appId = Application.applicationId ?? "app.snack.mobile";
  const fallback = Constants.expoConfig?.extra?.installationId as string | undefined;

  if (fallback) {
    return fallback;
  }

  // Simple stable ID from app config slug
  return `snack-${appId}`;
}

async function getInstallationIdAsync(): Promise<string> {
  // Prefer platform-specific async methods
  if (Device.osName === "Android") {
    return Application.getAndroidId();
  }

  if (Device.osName === "iOS") {
    const idfv = await Application.getIosIdForVendorAsync();
    if (idfv !== null) {
      return idfv;
    }
  }

  return getInstallationId();
}

function resolvePlatform(): DevicePlatform {
  const osName = Device.osName;
  if (osName === "iOS" || osName === "iPadOS") {
    return "ios";
  }
  return "android";
}

export function createNativeAuthServices({
  httpClient,
  apiBaseUrl,
  googleWebClientId,
  googleIosClientId
}: CreateNativeAuthServicesOptions): SessionShellServices {
  const extra = (Constants.expoConfig?.extra as Record<string, string> | undefined) ?? {};

  const webClientId =
    googleWebClientId ??
    extra.googleWebClientId ??
    "";

  const resolvedGoogleIosClientId = googleIosClientId ?? extra.googleIosClientId;

  const storage = createSecureSessionStorage({
    secureStore: SecureStore,
    config: apiBaseUrl ? { apiBaseUrl } : undefined
  });

  const authApi = createAuthApi(httpClient);
  const sessionApi = createSessionApi(httpClient);

  const nativeGoogle = createGoogleNativeAdapter({
    module: GoogleSignin,
    webClientId,
    iosClientId: resolvedGoogleIosClientId
  });

  const nativeApple = createAppleNativeAdapter({
    module: AppleAuthentication
  });

  const device = {
    async getDevice() {
      const installationId = await getInstallationIdAsync();

      return {
        installationId,
        platform: resolvePlatform(),
        deviceName: Device.deviceName ?? "Unknown"
      };
    }
  };

  return assembleAuthServices({
    googleWebClientId: webClientId,
    googleIosClientId: resolvedGoogleIosClientId,
    storage,
    authApi,
    sessionApi,
    device,
    nativeGoogle,
    nativeApple,
    navigation: {
      goToSignedOut() {
        // Navigation is handled by expo-router guards in the layout
      }
    }
  });
}
