import { useCallback, useEffect, useRef, useState } from "react";

import type { Profile, ProfileResponse } from "@cherry/contracts";

import { friendlyErrorMessage } from "../../../shared/api";

export type MyProfileStatus = "loading" | "ready" | "missing" | "error";

export interface MyProfileState {
  status: MyProfileStatus;
  /** Último perfil cargado. Se conserva mientras se recarga o si una recarga falla. */
  profile: Profile | null;
  /** Error de la carga inicial (sin perfil que enseñar). */
  error: string | null;
  /** Recarga en segundo plano con un perfil ya visible. */
  refreshing: boolean;
}

export interface UseMyProfileResult extends MyProfileState {
  /** Carga (o recarga en segundo plano) `GET /api/me/profile`. Agrupa llamadas simultáneas. */
  reload(): Promise<void>;
}

const initialState: MyProfileState = { status: "loading", profile: null, error: null, refreshing: false };

/**
 * Tu propio perfil (`GET /api/me/profile`). Carga al montar; la primera carga enseña skeleton y
 * las siguientes (p. ej. `reload()` al volver de editar) refrescan sin quitar lo que ya se ve.
 * `fetchProfile` debe ser estable (`useCallback`).
 */
export function useMyProfile(fetchProfile: () => Promise<ProfileResponse>): UseMyProfileResult {
  const [state, setState] = useState<MyProfileState>(initialState);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback((): Promise<void> => {
    if (inFlightRef.current !== null) {
      return inFlightRef.current;
    }

    const run = (async () => {
      setState((prev) =>
        prev.profile === null
          ? { status: "loading", profile: null, error: null, refreshing: false }
          : { ...prev, refreshing: true }
      );

      try {
        const response = await fetchProfile();
        if (!mountedRef.current) {
          return;
        }

        setState(
          response.profile === null
            ? { status: "missing", profile: null, error: null, refreshing: false }
            : { status: "ready", profile: response.profile, error: null, refreshing: false }
        );
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        const message = friendlyErrorMessage(error, "No hemos podido cargar tu perfil. Inténtalo otra vez.");
        setState((prev) =>
          prev.profile === null
            ? { status: "error", profile: null, error: message, refreshing: false }
            : { ...prev, refreshing: false }
        );
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, [fetchProfile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}
