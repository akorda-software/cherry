import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

import type { SecureStoreLike } from "@snack/mobile-shared";

/**
 * Almacén seguro de la plataforma: Keychain/Keystore en nativo. En web (solo
 * banco de pruebas de desarrollo) expo-secure-store no existe, así que se usa
 * localStorage; nunca se distribuye un cliente web con sesiones reales.
 */
export function resolveSecureStore(): SecureStoreLike {
  if (Platform.OS !== "web") {
    return SecureStore;
  }

  return {
    async getItemAsync(key) {
      return globalThis.localStorage?.getItem(key) ?? null;
    },
    async setItemAsync(key, value) {
      globalThis.localStorage?.setItem(key, value);
    },
    async deleteItemAsync(key) {
      globalThis.localStorage?.removeItem(key);
    }
  };
}
