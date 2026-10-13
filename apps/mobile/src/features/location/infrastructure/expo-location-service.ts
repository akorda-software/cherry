import { Linking } from "react-native";
import * as Location from "expo-location";

import type { LocationFix, LocationPermissionState, LocationService } from "../application/share-location";

const CURRENT_POSITION_TIMEOUT_MS = 12_000;
const LAST_KNOWN_MAX_AGE_MS = 15 * 60_000;

function toPermissionState(response: Location.LocationPermissionResponse): LocationPermissionState {
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

function toFix(position: Location.LocationObject): LocationFix {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? null,
    timestamp: position.timestamp || Date.now()
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("location_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Ubicación con expo-location. Precisión «equilibrada»: sobra para una rejilla de 500 m y gasta menos. */
export const expoLocationService: LocationService = {
  async getPermission() {
    return toPermissionState(await Location.getForegroundPermissionsAsync());
  },

  async requestPermission() {
    return toPermissionState(await Location.requestForegroundPermissionsAsync());
  },

  async getCurrentFix() {
    try {
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        CURRENT_POSITION_TIMEOUT_MS
      );
      return toFix(position);
    } catch {
      try {
        const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
        return last ? toFix(last) : null;
      } catch {
        return null;
      }
    }
  },

  async openSettings() {
    await Linking.openSettings();
  }
};
