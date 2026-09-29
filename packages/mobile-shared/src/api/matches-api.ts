import type { MatchSummary, MatchesResponse, OkResponse } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { pathSegment } from "./http-utils";

export interface MatchesApi {
  /** Matches activos (sin caducados, deshechos ni bloqueados), por actividad reciente. */
  list(): Promise<MatchSummary[]>;
  /** Deshace el match: la conversación deja de estar activa para ambos. */
  unmatch(matchId: string): Promise<void>;
}

export function createMatchesApi(httpClient: HttpClient): MatchesApi {
  return {
    async list() {
      const response = await httpClient.get<MatchesResponse>("/api/matches");
      return response.matches;
    },
    async unmatch(matchId) {
      await httpClient.post<OkResponse>(`/api/matches/${pathSegment(matchId)}/unmatch`, {});
    }
  };
}
