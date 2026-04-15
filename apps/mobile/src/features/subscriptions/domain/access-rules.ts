export interface AccessContext {
  subscribed?: boolean;
  featureFlagEnabled: boolean;
}

export function canAccess({ subscribed = false, featureFlagEnabled }: AccessContext): boolean {
  if (!featureFlagEnabled) {
    return true;
  }

  return subscribed;
}
