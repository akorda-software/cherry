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

export function createAuthCallbackPayload(
  payload: AuthCallbackPayload
): AuthCallbackPayload {
  return { ...payload, device: { ...payload.device } };
}
