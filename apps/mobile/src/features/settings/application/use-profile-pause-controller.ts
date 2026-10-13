import { useCallback, useEffect, useRef, useState } from "react";

import { friendlyErrorMessage } from "../../../shared/api";

export interface ProfilePauseDeps {
  /** Estado confirmado por el servidor (el bootstrap de la app). */
  isPaused: boolean;
  pause(): Promise<void>;
  unpause(): Promise<void>;
  /** Vuelve a pedir el bootstrap para que el resto de la app se entere. */
  refresh(): Promise<void>;
}

export interface ProfilePauseController {
  /** Lo que se enseña: el valor elegido mientras se guarda, luego el del servidor. */
  isPaused: boolean;
  pending: boolean;
  error: string | null;
  /** Pausa o reanuda. Devuelve `true` si el servidor lo ha aceptado. */
  setPaused(next: boolean): Promise<boolean>;
  clearError(): void;
}

/**
 * Pausar/reanudar el perfil con respuesta optimista: se ve el valor elegido mientras se
 * guarda y se sostiene hasta que el bootstrap lo refleja (aunque la recarga falle); si el
 * servidor rechaza el cambio, se deshace.
 */
export function useProfilePauseController({
  isPaused: confirmed,
  pause,
  unpause,
  refresh
}: ProfilePauseDeps): ProfilePauseController {
  const [override, setOverride] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // En cuanto el servidor confirma el valor elegido, deja de hacer falta el override.
  useEffect(() => {
    if (!pending && override !== null && override === confirmed) {
      setOverride(null);
    }
  }, [confirmed, override, pending]);

  const setPaused = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (pendingRef.current) {
        return false;
      }

      pendingRef.current = true;
      setPending(true);
      setError(null);
      setOverride(next);

      try {
        await (next ? pause() : unpause());
      } catch (err) {
        pendingRef.current = false;
        if (mountedRef.current) {
          setOverride(null);
          setPending(false);
          setError(
            friendlyErrorMessage(
              err,
              next
                ? "No hemos podido pausar tu perfil. Inténtalo otra vez."
                : "No hemos podido reanudar tu perfil. Inténtalo otra vez."
            )
          );
        }
        return false;
      }

      try {
        await refresh();
      } catch {
        // Nada que deshacer: el cambio ya está guardado en el servidor.
      }

      // El override se suelta solo cuando el bootstrap refleja el cambio (ver efecto de arriba):
      // una recarga que falla en silencio no debe hacer «saltar» el interruptor.
      pendingRef.current = false;
      if (mountedRef.current) {
        setPending(false);
      }
      return true;
    },
    [pause, refresh, unpause]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    isPaused: override ?? confirmed,
    pending,
    error,
    setPaused,
    clearError
  };
}
