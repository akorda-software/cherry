import type { PublicProfile, PublicProfileResponse } from "@snack/contracts";

import type { HttpClient } from "./auth-api";
import { pathSegment } from "./http-utils";

export interface PublicProfileApi {
  /** Perfil público de otra persona. 404 `profile_not_found` si no es visible para ti. */
  getProfile(profileId: string): Promise<PublicProfile>;
}

export function createPublicProfileApi(httpClient: HttpClient): PublicProfileApi {
  return {
    async getProfile(profileId) {
      const response = await httpClient.get<PublicProfileResponse>(
        `/api/profiles/${pathSegment(profileId)}`
      );
      return response.profile;
    }
  };
}
