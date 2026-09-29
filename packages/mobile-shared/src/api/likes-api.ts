import type { ReceivedLikesPage, ReceivedLikesQuery } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { buildCursorPath } from "./http-utils";

export interface LikesApi {
  /**
   * Personas que te han dado like y a las que aún no has respondido (más reciente primero).
   * Para responder usa `DiscoveryApi.recordAction` (like → match al instante).
   */
  listReceived(query?: ReceivedLikesQuery): Promise<ReceivedLikesPage>;
}

export function createLikesApi(httpClient: HttpClient): LikesApi {
  return {
    listReceived(query) {
      return httpClient.get<ReceivedLikesPage>(buildCursorPath("/api/likes/received", query));
    }
  };
}
