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
  signOut(): Promise<unknown>;
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

      // Google recuerda la última cuenta elegida y la reutiliza sin preguntar. Olvidarla antes
      // de cada login hace que salga siempre el selector, para poder entrar con otra cuenta.
      // Cherry no usa la sesión de Google después del login (el backend emite la suya).
      await module.signOut().catch(() => undefined);

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
