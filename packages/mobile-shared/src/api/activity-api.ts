import type { ActivitySummary } from "@cherry/contracts";

import type { HttpClient } from "./auth-api";

export interface ActivityApi {
  /** Contadores para los badges de las pestañas (likes, matches nuevos, chats sin leer). */
  getSummary(): Promise<ActivitySummary>;
}

export function createActivityApi(httpClient: HttpClient): ActivityApi {
  return {
    getSummary() {
      return httpClient.get<ActivitySummary>("/api/me/summary");
    }
  };
}
