import type { OkResponse } from "@cherry/contracts";

import type { HttpClient } from "./auth-api";
import { httpDelete } from "./http-utils";

export interface SettingsApi {
  /** Oculta el perfil de discovery y likes (los matches existentes siguen activos). */
  pause(): Promise<void>;
  /** Restaura la visibilidad si el perfil sigue completo. */
  unpause(): Promise<void>;
  /** Borrado lógico de la cuenta: revoca todas las sesiones. Tras esto, limpiar la sesión local. */
  deleteAccount(): Promise<void>;
}

export function createSettingsApi(httpClient: HttpClient): SettingsApi {
  return {
    async pause() {
      await httpClient.post<OkResponse>("/api/me/pause", {});
    },
    async unpause() {
      await httpClient.post<OkResponse>("/api/me/unpause", {});
    },
    async deleteAccount() {
      await httpDelete<OkResponse>(httpClient, "/api/me/account");
    }
  };
}
