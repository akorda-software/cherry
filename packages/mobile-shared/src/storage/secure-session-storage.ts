import type { SessionBundle } from "@snack/contracts";

import { createSessionBundle } from "@snack/contracts";
import { createAuthConfig, type AuthConfig } from "../config/auth-config";

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export interface SessionStorage {
  read(): Promise<SessionBundle | null>;
  write(session: SessionBundle): Promise<void>;
  clear(): Promise<void>;
}

interface CreateSecureSessionStorageOptions {
  secureStore: SecureStoreLike;
  config?: Partial<AuthConfig>;
}

export function createSecureSessionStorage({
  secureStore,
  config
}: CreateSecureSessionStorageOptions): SessionStorage {
  const resolvedConfig = createAuthConfig(config);

  return {
    async read() {
      const rawValue = await secureStore.getItemAsync(resolvedConfig.secureStorageKey);

      if (rawValue === null) {
        return null;
      }

      return createSessionBundle(JSON.parse(rawValue) as SessionBundle);
    },

    async write(session) {
      await secureStore.setItemAsync(
        resolvedConfig.secureStorageKey,
        JSON.stringify(createSessionBundle(session))
      );
    },

    async clear() {
      await secureStore.deleteItemAsync(resolvedConfig.secureStorageKey);
    }
  };
}
