/**
 * Mock for expo-apple-authentication in jsdom tests.
 */
export const isAvailableAsync = vi.fn(() => Promise.resolve(false));
export const signInAsync = vi.fn();
export const AppleAuthenticationScope = {
  FULL_NAME: 0,
  EMAIL: 1
};
export const AppleAuthenticationCredentialState = {
  REVOKED: 0,
  AUTHORIZED: 1,
  NOT_FOUND: 2,
  TRANSFERRED: 3
};
export const getCredentialStateAsync = vi.fn();
