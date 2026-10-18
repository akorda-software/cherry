export type DevicePlatform = "ios" | "android";

export interface DeviceDescriptor {
  installationId: string;
  platform: DevicePlatform;
  deviceName: string;
}

export interface AuthCallbackPayload {
  providerToken: string;
  device: DeviceDescriptor;
  idToken?: string;
  authorizationCode?: string;
  nonce?: string;
}

export type AuthMethodProvider = "google" | "apple";
export type AuthMethodCredential = Omit<AuthCallbackPayload, "device">;
export interface AuthMethodsSnapshot {
  methods: Array<{ provider: AuthMethodProvider; canUnlink: boolean }>;
}
export interface AuthMethodProof {
  currentProvider: AuthMethodProvider;
  currentCredential: AuthMethodCredential;
  credential?: AuthMethodCredential;
}

export function createAuthCallbackPayload(
  payload: AuthCallbackPayload
): AuthCallbackPayload {
  return { ...payload, device: { ...payload.device } };
}
