import type { SessionBundle } from "@snack/contracts";

import type { AuthSessionStorage } from "../domain/session-storage";

interface CreateBootstrapSessionOptions {
  storage: AuthSessionStorage;
}

export function createBootstrapSession({ storage }: CreateBootstrapSessionOptions) {
  return {
    execute(): Promise<SessionBundle | null> {
      return storage.read();
    }
  };
}
