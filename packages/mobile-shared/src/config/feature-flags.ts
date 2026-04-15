import { createBootstrapConfig, type BootstrapConfig } from "@snack/contracts";

export interface FeatureFlagReader {
  isEnabled(flagKey: string): boolean;
}

export function createFeatureFlagReader(bootstrap: BootstrapConfig): FeatureFlagReader {
  const config = createBootstrapConfig(bootstrap);

  return {
    isEnabled(flagKey: string): boolean {
      return config.features[flagKey]?.enabled === true;
    }
  };
}
