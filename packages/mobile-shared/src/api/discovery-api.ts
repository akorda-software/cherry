import type {
  DiscoveryActionRequest,
  DiscoveryActionResponse,
  DiscoveryFeedPage,
  DiscoveryFeedQuery
} from "@cherry/contracts";

import type { HttpClient } from "./auth-api";

export interface DiscoveryApi {
  getFeed(query?: DiscoveryFeedQuery): Promise<DiscoveryFeedPage>;
  recordAction(request: DiscoveryActionRequest): Promise<DiscoveryActionResponse>;
}

function buildFeedPath(query?: DiscoveryFeedQuery): string {
  const parts: string[] = [];

  if (query?.limit !== undefined) {
    parts.push(`limit=${encodeURIComponent(String(query.limit))}`);
  }

  if (query?.cursor) {
    parts.push(`cursor=${encodeURIComponent(query.cursor)}`);
  }

  return parts.length === 0 ? "/api/discovery/feed" : `/api/discovery/feed?${parts.join("&")}`;
}

export function createDiscoveryApi(httpClient: HttpClient): DiscoveryApi {
  return {
    getFeed(query) {
      return httpClient.get<DiscoveryFeedPage>(buildFeedPath(query));
    },
    recordAction(request) {
      return httpClient.post<DiscoveryActionResponse>("/api/discovery/actions", {
        target_profile_id: request.targetProfileId,
        action_type: request.actionType
      });
    }
  };
}
