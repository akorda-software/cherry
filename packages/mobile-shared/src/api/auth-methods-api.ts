import type { AuthMethodProof, AuthMethodProvider, AuthMethodsSnapshot } from "@cherry/contracts";
import type { HttpClient } from "./auth-api";

export function createAuthMethodsApi(client: HttpClient) {
  return {
    list: () => client.get<AuthMethodsSnapshot>("/api/me/auth-methods"),
    link: (provider: AuthMethodProvider, proof: AuthMethodProof) =>
      client.post<AuthMethodsSnapshot>(`/api/me/auth-methods/${provider}`, proof),
    unlink: (provider: AuthMethodProvider, proof: AuthMethodProof) =>
      client.post<AuthMethodsSnapshot>(`/api/me/auth-methods/${provider}/unlink`, proof)
  };
}
