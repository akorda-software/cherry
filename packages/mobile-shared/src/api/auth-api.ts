import type { AuthCallbackPayload, SessionBundle } from "@snack/contracts";

export type AuthProvider = "google" | "apple";

export interface HttpClient {
  get<TResponse>(path: string): Promise<TResponse>;
  post<TResponse>(path: string, body: unknown): Promise<TResponse>;
  delete?<TResponse>(path: string, body: unknown): Promise<TResponse>;
}

export interface AuthApi {
  completeCallback(provider: AuthProvider, payload: AuthCallbackPayload): Promise<SessionBundle>;
}

export interface SessionApi {
  refresh(refreshToken: string): Promise<SessionBundle>;
  revoke(refreshToken: string): Promise<void>;
}

export function createAuthApi(httpClient: HttpClient): AuthApi {
  return {
    completeCallback(provider, payload) {
      return httpClient.post<SessionBundle>(`/api/auth/${provider}/callback`, payload);
    }
  };
}

export function createSessionApi(httpClient: HttpClient): SessionApi {
  return {
    refresh(refreshToken) {
      return httpClient.post<SessionBundle>("/api/session/refresh", { refreshToken });
    },
    async revoke(refreshToken) {
      if (httpClient.delete) {
        await httpClient.delete<void>("/api/session", { refreshToken });
        return;
      }

      await httpClient.post<void>("/api/session/revoke", { refreshToken });
    }
  };
}
