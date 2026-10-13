import type {
  DiscoveryActionRequest,
  DiscoveryActionResponse,
  DiscoveryFeedPage,
  DiscoveryFeedQuery,
  DiscoveryUndoResponse
} from "@cherry/contracts";

import type { HttpClient } from "./auth-api";
import { buildCursorPath } from "./http-utils";

export interface DiscoveryApi {
  getFeed(query?: DiscoveryFeedQuery): Promise<DiscoveryFeedPage>;
  /**
   * Like/dislike. También sirve para responder desde la pestaña Likes: si esa persona ya te
   * dio like, la respuesta es `{ matchCreated: true, match }` al instante.
   */
  recordAction(request: DiscoveryActionRequest): Promise<DiscoveryActionResponse>;
  /**
   * Deshace el último "no" (< 10 min). Error 422 `nothing_to_undo` si no hay nada que deshacer.
   * `profile` es `null` si se deshizo pero esa persona ya no es visible.
   */
  undo(): Promise<DiscoveryUndoResponse>;
}

export function createDiscoveryApi(httpClient: HttpClient): DiscoveryApi {
  return {
    getFeed(query) {
      return httpClient.get<DiscoveryFeedPage>(buildCursorPath("/api/discovery/feed", query));
    },
    recordAction(request) {
      return httpClient.post<DiscoveryActionResponse>("/api/discovery/actions", {
        target_profile_id: request.targetProfileId,
        action_type: request.actionType
      });
    },
    undo() {
      return httpClient.post<DiscoveryUndoResponse>("/api/discovery/undo", {});
    }
  };
}
