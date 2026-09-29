import { useCallback, useEffect, useRef, useState } from "react";

import { friendlyErrorMessage } from "../../../shared/api";

export interface DeleteAccountDeps {
  /** `DELETE /api/me/account`: desactiva la cuenta y revoca todas las sesiones. */
  deleteAccount(): Promise<void>;
  /** Limpia la sesión local (después del borrado, el refresh token ya no vale). */
  signOut(): Promise<void>;
  /** Se llama una vez borrada la cuenta y limpia la sesión: navegar y despedirse. */
  onDeleted(): void;
}

export interface DeleteAccountAction {
  pending: boolean;
  error: string | null;
  /** Devuelve `true` si la cuenta se ha borrado. */
  run(): Promise<boolean>;
  clearError(): void;
}

export function useDeleteAccount({ deleteAccount, signOut, onDeleted }: DeleteAccountDeps): DeleteAccountAction {
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

  const run = useCallback(async (): Promise<boolean> => {
    if (pendingRef.current) {
      return false;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);

    try {
      await deleteAccount();
    } catch (err) {
      pendingRef.current = false;
      if (mountedRef.current) {
        setPending(false);
        setError(
          friendlyErrorMessage(err, "No hemos podido borrar tu cuenta. Inténtalo otra vez en un momento.")
        );
      }
      return false;
    }

    // La cuenta ya no existe: aunque limpiar la sesión falle, hay que salir.
    try {
      await signOut();
    } catch {
      // Sin sesión válida en el servidor; lo local se limpia igualmente al salir.
    }

    pendingRef.current = false;
    if (mountedRef.current) {
      setPending(false);
    }
    onDeleted();

    return true;
  }, [deleteAccount, onDeleted, signOut]);

  const clearError = useCallback(() => setError(null), []);

  return { pending, error, run, clearError };
}
