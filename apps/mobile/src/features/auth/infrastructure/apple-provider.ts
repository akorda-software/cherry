import { createAuthCallbackPayload, type AuthCallbackPayload } from "@snack/contracts";

interface NativeAppleCredential {
  providerToken: string;
  authorizationCode: string;
  idToken: string;
  nonce: string;
}

interface DeviceDetails {
  installationId: string;
  platform: "ios" | "android";
  deviceName: string;
}

interface CreateAppleProviderOptions {
  signIn(): Promise<NativeAppleCredential>;
  getDevice(): Promise<DeviceDetails>;
}

export function createAppleProvider({ signIn, getDevice }: CreateAppleProviderOptions) {
  return {
    async authenticate(): Promise<{ provider: "apple"; payload: AuthCallbackPayload }> {
      const [credential, device] = await Promise.all([signIn(), getDevice()]);

      return {
        provider: "apple",
        payload: createAuthCallbackPayload({
          providerToken: credential.providerToken,
          authorizationCode: credential.authorizationCode,
          idToken: credential.idToken,
          nonce: credential.nonce,
          device
        })
      };
    }
  };
}
