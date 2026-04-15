/**
 * Mock for @react-native-google-signin/google-signin in jsdom tests.
 */
export const GoogleSignin = {
  configure: vi.fn(),
  signIn: vi.fn(async () => ({ type: "cancelled", data: null }) as const),
  hasPlayServices: vi.fn(() => Promise.resolve(true)),
  signOut: vi.fn(),
  getCurrentUser: vi.fn(() => null),
  revokeAccess: vi.fn()
};
