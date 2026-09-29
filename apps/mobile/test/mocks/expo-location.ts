import { vi } from "vitest";

/**
 * Mock de expo-location: sin permiso por defecto. Los tests lo cambian caso a caso con
 * `vi.mocked(Location.getForegroundPermissionsAsync).mockResolvedValueOnce(...)`.
 */
export enum Accuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6
}

const denied = { granted: false, canAskAgain: true, status: "denied", expires: "never" } as const;

export const getForegroundPermissionsAsync = vi.fn(async () => ({ ...denied }));
export const requestForegroundPermissionsAsync = vi.fn(async () => ({ ...denied }));
export const getCurrentPositionAsync = vi.fn(async () => ({
  coords: { latitude: 40.4168, longitude: -3.7038, accuracy: 30, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
  timestamp: Date.now()
}));
export const getLastKnownPositionAsync = vi.fn(async () => null);
