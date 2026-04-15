export interface AuthConfig {
  apiBaseUrl: string;
  secureStorageKey: string;
  googleWebClientId: string;
  googleIosClientId?: string;
}

export const defaultAuthConfig: AuthConfig = {
  apiBaseUrl: "/api",
  secureStorageKey: "snack.auth.session",
  googleWebClientId: ""
};

export function createAuthConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    ...defaultAuthConfig,
    ...overrides
  };
}
