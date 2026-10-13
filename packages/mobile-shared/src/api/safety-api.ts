import type { OkResponse, ProfileReport, ReportRequest, ReportResponse } from "@cherry/contracts";

import type { HttpClient } from "./auth-api";
import { pathSegment } from "./http-utils";

export interface SafetyApi {
  /** Bloquea a la persona: desaparece de discovery, likes y matches en ambas direcciones. */
  block(profileId: string): Promise<void>;
  report(profileId: string, request: ReportRequest): Promise<ProfileReport>;
}

export function createSafetyApi(httpClient: HttpClient): SafetyApi {
  return {
    async block(profileId) {
      await httpClient.post<OkResponse>(`/api/users/${pathSegment(profileId)}/block`, {});
    },
    async report(profileId, request) {
      const body: Record<string, unknown> = { reason: request.reason };
      if (request.details !== undefined) body.details = request.details;

      const response = await httpClient.post<ReportResponse>(
        `/api/users/${pathSegment(profileId)}/report`,
        body
      );
      return response.report;
    }
  };
}
