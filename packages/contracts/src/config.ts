export interface FeatureFlagState {
  enabled: boolean;
}

export interface BootstrapConfig {
  features: Record<string, FeatureFlagState>;
}

export function createBootstrapConfig(config: BootstrapConfig): BootstrapConfig {
  return {
    features: Object.fromEntries(
      Object.entries(config.features).map(([key, value]) => [key, { enabled: value.enabled }])
    )
  };
}
