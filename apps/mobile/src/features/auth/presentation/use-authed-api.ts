import { useCallback } from "react";

import type { HttpClient } from "@snack/mobile-shared";

import { createJsonHttpClient } from "../../../shared/api";
import { useRuntimeConfig } from "../../../shared/config";
import { useSessionShell } from "./session-shell-provider";

/**
 * Devuelve `callApi(run)`: ejecuta `run` con un cliente de la API ya autenticado
 * (refresca el token y reintenta una vez ante un 401). `factory` debe ser estable
 * (p. ej. `createDiscoveryApi` importado a nivel de módulo).
 *
 *   const callApi = useAuthedApi(createMatchesApi);
 *   const { matches } = await callApi((api) => api.list());
 */
export function useAuthedApi<TApi>(factory: (client: HttpClient) => TApi) {
  const { executeAuthenticated } = useSessionShell();
  const { apiBaseUrl } = useRuntimeConfig();

  return useCallback(
    <T,>(run: (api: TApi) => Promise<T>) =>
      executeAuthenticated((token) =>
        run(
          factory(
            createJsonHttpClient({
              apiBaseUrl,
              getHeaders: () => ({ Authorization: `Bearer ${token}` })
            })
          )
        )
      ),
    [apiBaseUrl, executeAuthenticated, factory]
  );
}
