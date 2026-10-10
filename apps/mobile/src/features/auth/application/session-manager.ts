import type { SessionBundle } from "@cherry/contracts";

import type { SessionApi } from "@cherry/mobile-shared";
import type { AuthSessionStorage } from "../domain/session-storage";

interface NavigationPort {
  /** La sesión ya no vale (refresh rechazado, almacenamiento vacío): cierra la sesión de verdad. */
  goToSignedOut(): void;
}

interface CreateSessionManagerOptions {
  storage: AuthSessionStorage;
  sessionApi: SessionApi;
  navigation: NavigationPort;
  now?: () => Date;
}

/**
 * Solo un rechazo del endpoint de refresco invalida la sesión (token inválido, reusado, revocado,
 * cuenta borrada). Sin red, timeouts, 5xx o 429 son transitorios: la sesión guardada se conserva.
 */
export function isFatalRefreshError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null ? (error as { status?: unknown }).status : undefined;
  return status === 400 || status === 401 || status === 403;
}

export function createSessionManager({
  storage,
  sessionApi,
  navigation,
  now = () => new Date()
}: CreateSessionManagerOptions) {
  /**
   * Época de la sesión: sube al cerrar sesión. Un refresco o reintento que empezó en otra época
   * nunca escribe en el almacenamiento ni reintenta con tokens de otra persona.
   */
  let epoch = 0;

  async function refreshAndPersist(session: SessionBundle, startedEpoch: number): Promise<SessionBundle | null> {
    let refreshed: SessionBundle;

    try {
      refreshed = await sessionApi.refresh(session.refreshToken);
    } catch (error) {
      if (startedEpoch !== epoch) {
        return null;
      }

      if (!isFatalRefreshError(error)) {
        // Transitorio: se relanza sin tocar la sesión guardada.
        throw error;
      }

      await storage.clear();
      navigation.goToSignedOut();
      return null;
    }

    // Si mientras tanto se cerró la sesión (o entró otra persona), no la resucitamos.
    const current = startedEpoch === epoch ? await storage.read() : null;
    if (startedEpoch !== epoch || current === null || current.user.id !== session.user.id) {
      return null;
    }

    await storage.write(refreshed);
    return refreshed;
  }

  // Un solo refresco a la vez: el backend rota el refresh token y reusarlo revoca la sesión
  // entera, así que varios 401 simultáneos (volver a primer plano) deben compartir el refresco.
  let refreshInFlight: { epoch: number; promise: Promise<SessionBundle | null> } | null = null;

  function refreshOnce(session: SessionBundle): Promise<SessionBundle | null> {
    if (refreshInFlight === null || refreshInFlight.epoch !== epoch) {
      const entry = {
        epoch,
        promise: refreshAndPersist(session, epoch).finally(() => {
          if (refreshInFlight === entry) {
            refreshInFlight = null;
          }
        })
      };
      refreshInFlight = entry;
    }

    return refreshInFlight.promise;
  }

  return {
    async bootstrap(): Promise<SessionBundle | null> {
      const session = await storage.read();

      if (session === null) {
        return null;
      }

      if (new Date(session.accessTokenExpiresAt).getTime() > now().getTime()) {
        return session;
      }

      try {
        return await refreshOnce(session);
      } catch {
        // Arranque en frío sin red: entramos con la sesión guardada; la primera petición con
        // red volverá a refrescarla (y si el servidor la rechaza, entonces sí se cierra).
        return session;
      }
    },

    /** Invalida refrescos y reintentos en vuelo (se llama al cerrar sesión). */
    invalidate(): void {
      epoch += 1;
      refreshInFlight = null;
    },

    async executeWithRefresh<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
      const startedEpoch = epoch;
      const session = await storage.read();

      if (session === null) {
        navigation.goToSignedOut();
        throw new Error("missing_session");
      }

      try {
        return await request(session.accessToken);
      } catch (error) {
        if (!isUnauthorized(error)) {
          throw error;
        }

        if (startedEpoch !== epoch) {
          throw new Error("session_changed");
        }

        const latest = await storage.read();

        if (latest === null) {
          // Nadie debe resucitar la sesión: sin nada guardado, se sale.
          navigation.goToSignedOut();
          throw new Error("missing_session");
        }

        if (startedEpoch !== epoch || latest.user.id !== session.user.id) {
          throw new Error("session_changed");
        }

        // Otra petición pudo rotar la sesión mientras esta volaba: reintenta con la guardada.
        if (latest.accessToken !== session.accessToken) {
          return request(latest.accessToken);
        }

        const refreshed = await refreshOnce(latest);

        if (refreshed === null) {
          throw new Error("session_refresh_failed");
        }

        if (startedEpoch !== epoch) {
          throw new Error("session_changed");
        }

        return request(refreshed.accessToken);
      }
    }
  };
}

function isUnauthorized(error: unknown): error is { status: number } {
  return typeof error === "object" && error !== null && "status" in error && error.status === 401;
}
