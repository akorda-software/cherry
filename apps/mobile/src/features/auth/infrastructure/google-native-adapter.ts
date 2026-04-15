interface GoogleUser {
  idToken: string | null;
  serverAuthCode: string | null;
}

interface GoogleSignInModule {
  configure(params: {
    webClientId?: string;
    iosClientId?: string;
    offlineAccess?: boolean;
  }): void;
  signIn(): Promise<
    | { type: "success"; data: GoogleUser }
    | { type: "cancelled"; data: null }
  >;
  hasPlayServices(params?: { showPlayServicesUpdateDialog: boolean }): Promise<boolean>;
}

interface CreateGoogleNativeAdapterOptions {
  module: GoogleSignInModule;
  webClientId: string;
  iosClientId?: string;
}

export function createGoogleNativeAdapter({
  module,
  webClientId,
  iosClientId
}: CreateGoogleNativeAdapterOptions) {
  module.configure({
    webClientId,
    iosClientId,
    offlineAccess: false
  });

  return {
    async signIn(): Promise<{ providerToken: string }> {
      const hasPlayServices = await module.hasPlayServices({
        showPlayServicesUpdateDialog: true
      });

      if (!hasPlayServices) {
        throw new Error("Google Play Services is required but not available");
      }

      const response = await module.signIn();

      if (response.type === "cancelled") {
        throw new Error("Google Sign-In was cancelled by the user");
      }

      if (response.data.idToken === null) {
        throw new Error("Google Sign-In did not return an ID token");
      }

      return { providerToken: response.data.idToken };
    }
  };
}
