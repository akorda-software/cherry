export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
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
