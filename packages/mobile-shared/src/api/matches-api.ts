import type { ConversationMatchResponse, InboxPageQuery, MatchSummary, MatchesResponse, OkResponse } from "@cherry/contracts";

import type { HttpClient } from "./auth-api";
import { buildCursorPath, pathSegment } from "./http-utils";

export interface MatchesApi {
  /** Matches activos (sin caducados, deshechos ni bloqueados), por actividad reciente. */
  list(query?: InboxPageQuery): Promise<MatchesResponse>;
  /** Resuelve un enlace a un chat sin descargar toda la bandeja. */
  getForConversation(conversationId: string): Promise<MatchSummary>;
  /** Deshace el match: la conversación deja de estar activa para ambos. */
  unmatch(matchId: string): Promise<void>;
}

export function createMatchesApi(httpClient: HttpClient): MatchesApi {
  return {
    list(query) {
      return httpClient.get<MatchesResponse>(buildCursorPath("/api/matches", query));
    },
    async getForConversation(conversationId) {
      const response = await httpClient.get<ConversationMatchResponse>(`/api/conversations/${pathSegment(conversationId)}/match`);
      return response.match;
    },
    async unmatch(matchId) {
      await httpClient.post<OkResponse>(`/api/matches/${pathSegment(matchId)}/unmatch`, {});
    }
  };
}
