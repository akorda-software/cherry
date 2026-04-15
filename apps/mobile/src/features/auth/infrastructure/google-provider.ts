import { createAuthCallbackPayload, type AuthCallbackPayload } from "@snack/contracts";

interface NativeGoogleCredential {
  providerToken: string;
}

interface DeviceDetails {
  installationId: string;
  platform: "ios" | "android";
  deviceName: string;
}

interface CreateGoogleProviderOptions {
  signIn(): Promise<NativeGoogleCredential>;
  getDevice(): Promise<DeviceDetails>;
}

export function createGoogleProvider({ signIn, getDevice }: CreateGoogleProviderOptions) {
  return {
    async authenticate(): Promise<{ provider: "google"; payload: AuthCallbackPayload }> {
      const [credential, device] = await Promise.all([signIn(), getDevice()]);

      return {
        provider: "google",
        payload: createAuthCallbackPayload({
          providerToken: credential.providerToken,
          device
        })
      };
    }
  };
}
