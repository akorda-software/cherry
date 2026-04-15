export interface FeatureFlagState {
  enabled: boolean;
}

export interface StripeMobileConfig {
  publishableKey: string;
  merchantDisplayName: string;
  merchantIdentifier?: string;
  urlScheme?: string;
}

export interface RuntimeServicesConfig {
  stripe?: StripeMobileConfig;
}

export interface BootstrapConfig {
  features: Record<string, FeatureFlagState>;
  services?: RuntimeServicesConfig;
}

export function createBootstrapConfig(config: BootstrapConfig): BootstrapConfig {
  return {
    features: Object.fromEntries(
      Object.entries(config.features).map(([key, value]) => [key, { enabled: value.enabled }])
    ),
    services: config.services
      ? {
          stripe: config.services.stripe
            ? {
                publishableKey: config.services.stripe.publishableKey,
                merchantDisplayName: config.services.stripe.merchantDisplayName,
                merchantIdentifier: config.services.stripe.merchantIdentifier,
                urlScheme: config.services.stripe.urlScheme
              }
            : undefined
        }
      : undefined
  };
}
