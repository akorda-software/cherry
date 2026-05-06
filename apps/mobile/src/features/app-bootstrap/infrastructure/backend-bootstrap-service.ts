import type { AppBootstrap } from "../domain/bootstrap";

interface HttpError extends Error {
  status?: number;
}

export interface AppBootstrapService {
  fetchBootstrap(accessToken: string): Promise<AppBootstrap>;
}

export function createBackendAppBootstrapService(apiBaseUrl: string): AppBootstrapService {
  return {
    async fetchBootstrap(accessToken) {
      const response = await fetch(`${apiBaseUrl}/api/bootstrap`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        const error = new Error(`Bootstrap failed with status ${response.status}`) as HttpError;
        error.status = response.status;
        throw error;
      }

      return (await response.json()) as AppBootstrap;
    }
  };
}

export function createMockAppBootstrapService(
  profile: Partial<AppBootstrap["profile"]> = {}
): AppBootstrapService {
  return {
    async fetchBootstrap() {
      return {
        user: {
          id: "dev-user",
          email: "dev@snack.app",
          displayName: "Dev User"
        },
        profile: {
          exists: true,
          isComplete: true,
          isDiscoverable: true,
          isPaused: false,
          onboardingRequired: false,
          nextOnboardingStep: null,
          ...profile
        }
      };
    }
  };
}
