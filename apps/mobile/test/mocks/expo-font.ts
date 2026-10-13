/** expo-font mock: fonts are always "loaded" in tests. */
export const useFonts = vi.fn((_map?: Record<string, unknown>) => [true, null] as const);
export const loadAsync = vi.fn(async () => undefined);
export const isLoaded = vi.fn(() => true);
