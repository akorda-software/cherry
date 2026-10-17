import type { HttpClient } from "@cherry/mobile-shared";
import type { LegalDeclarations, LegalPublication, LegalStatus } from "../domain/legal";

export function createLegalApi(client: HttpClient) {
  return {
    get: () => client.get<{ publication: LegalPublication; status: LegalStatus }>("/api/me/legal"),
    accept: (publication: LegalPublication, declarations: LegalDeclarations) =>
      client.post<{ accepted: true; acceptedAt: string }>("/api/me/legal", {
        version: publication.version,
        fingerprint: publication.fingerprint,
        ...declarations
      })
  };
}
