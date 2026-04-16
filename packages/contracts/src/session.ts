export type SessionUserRole = string;
export type SessionUserTier = string;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  roles?: SessionUserRole[];
  tier?: SessionUserTier | null;
}

export interface SessionBundle {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: SessionUser;
}

export function createSessionBundle(bundle: SessionBundle): SessionBundle {
  return {
    ...bundle,
    user: { ...bundle.user }
  };
}
