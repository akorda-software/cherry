import * as Crypto from "expo-crypto";

import { createAppleAuthNonce } from "./apple-auth-nonce";

interface AppleCredential {
  providerToken: string;
  authorizationCode: string;
  idToken: string;
  nonce: string;
}

interface AppleAuthenticationSignInOptions {
  requestedScopes?: number[];
  state?: string;
  nonce?: string;
}

interface AppleCredentialResponse {
  user: string;
  state: string | null;
  fullName: {
    namePrefix: string | null;
    givenName: string | null;
    middleName: string | null;
    familyName: string | null;
    nameSuffix: string | null;
    nickname: string | null;
  } | null;
  email: string | null;
  realUserStatus: number;
  identityToken: string | null;
  authorizationCode: string | null;
}

interface AppleSignInModule {
  isAvailableAsync(): Promise<boolean>;
  signInAsync(options?: AppleAuthenticationSignInOptions): Promise<AppleCredentialResponse>;
}

/** Apple Authentication scope constants — matches expo-apple-authentication enum values */
const APPLE_AUTH_SCOPE_FULL_NAME = 0;
const APPLE_AUTH_SCOPE_EMAIL = 1;

interface CreateAppleNativeAdapterOptions {
  module: AppleSignInModule;
  cryptoModule?: typeof Crypto;
}

export function createAppleNativeAdapter({ module, cryptoModule = Crypto }: CreateAppleNativeAdapterOptions) {
  return {
    async signIn(): Promise<AppleCredential> {
      const available = await module.isAvailableAsync();

      if (!available) {
        throw new Error("Apple Sign-In is not available on this device");
      }

      const { rawNonce, hashedNonce } = await createAppleAuthNonce(cryptoModule);

      const credential = await module.signInAsync({
        requestedScopes: [APPLE_AUTH_SCOPE_FULL_NAME, APPLE_AUTH_SCOPE_EMAIL],
        nonce: hashedNonce
      });

      if (credential.identityToken === null) {
        throw new Error("Apple Sign-In did not return an identity token");
      }

      if (credential.authorizationCode === null) {
        throw new Error("Apple Sign-In did not return an authorization code");
      }

      return {
        providerToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        idToken: credential.identityToken,
        nonce: rawNonce
      };
    }
  };
}
