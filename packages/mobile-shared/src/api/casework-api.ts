import type { CaseNotice, CreateSupportCaseRequest, OkResponse, SupportCase } from "@cherry/contracts";
import type { HttpClient } from "./auth-api";
import { buildQueryPath, pathSegment } from "./http-utils";

export function createCaseworkApi(client: HttpClient) {
  return {
    list: (offset = 0) => client.get<{ cases: SupportCase[] }>(buildQueryPath("/api/me/cases", { offset })),
    get: (id: string) => client.get<{ case: SupportCase }>(`/api/me/cases/${pathSegment(id)}`),
    create: (request: CreateSupportCaseRequest) => client.post<{ case: SupportCase }>("/api/me/cases", request),
    appeal: (id: string, statement: string) =>
      client.post<{ case: SupportCase }>(`/api/me/cases/${pathSegment(id)}/appeal`, { statement }),
    notices: (offset = 0) => client.get<{ notices: CaseNotice[] }>(buildQueryPath("/api/me/notices", { offset })),
    readNotice: (id: string) => client.post<OkResponse>(`/api/me/notices/${pathSegment(id)}/read`, {})
  };
}
