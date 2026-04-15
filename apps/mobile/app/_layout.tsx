import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Slot } from "expo-router";
import Constants from "expo-constants";
import { StripeProvider } from "@stripe/stripe-react-native";

import type { BootstrapConfig } from "@snack/contracts";
import { createConfigApi, createFeatureFlagReader, type FeatureFlagReader } from "@snack/mobile-shared";

import { createNativeAuthServices } from "../src/features/auth/infrastructure";
import { SessionShellProvider, type SessionShellServices } from "../src/features/auth/presentation";
import { createJsonHttpClient } from "../src/shared/api";
import { RuntimeConfigProvider } from "../src/shared/config";
import { ThemeProvider } from "../src/shared/ui";

function resolveApiBaseUrl() {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

  if (Platform.OS === "android") {
    return extra.apiBaseUrlAndroid ?? "http://10.0.2.2:4000";
  }

  if (Platform.OS === "ios") {
    return extra.apiBaseUrlIos ?? "http://localhost:4000";
  }

  return extra.apiBaseUrlWeb ?? "";
}

export function RootLayout({
  children,
  services,
  apiBaseUrl,
  bootstrapConfig,
  featureFlagReader,
  featureFlagLoading = false
}: PropsWithChildren<{
  services?: SessionShellServices;
  apiBaseUrl: string;
  bootstrapConfig: BootstrapConfig | null;
  featureFlagReader: FeatureFlagReader | null;
  featureFlagLoading?: boolean;
}>) {
  const stripeConfig = bootstrapConfig?.services?.stripe;

  const content = (
    <RuntimeConfigProvider
      apiBaseUrl={apiBaseUrl}
      bootstrapConfig={bootstrapConfig}
      reader={featureFlagReader}
      loading={featureFlagLoading}
    >
      <SessionShellProvider services={services}>{children ?? <Slot />}</SessionShellProvider>
    </RuntimeConfigProvider>
  );

  return (
    <ThemeProvider>
      {stripeConfig ? (
        <StripeProvider
          publishableKey={stripeConfig.publishableKey}
          merchantIdentifier={stripeConfig.merchantIdentifier}
          urlScheme={stripeConfig.urlScheme}
        >
          {content}
        </StripeProvider>
      ) : (
        content
      )}
    </ThemeProvider>
  );
}

export default function RootLayoutRoute() {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [bootstrapConfig, setBootstrapConfig] = useState<BootstrapConfig | null>(null);
  const [featureFlagReader, setFeatureFlagReader] = useState<FeatureFlagReader | null>(null);
  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);

  const services = useMemo(() => {
    const httpClient = createJsonHttpClient({ apiBaseUrl });

    return createNativeAuthServices({
      apiBaseUrl,
      httpClient
    });
  }, [apiBaseUrl]);

  useEffect(() => {
    let cancelled = false;
    const httpClient = createJsonHttpClient({ apiBaseUrl });
    const configApi = createConfigApi(httpClient);

    void configApi.getBootstrapConfig().then(
      (config) => {
        if (cancelled) {
          return;
        }

        setBootstrapConfig(config);
        setFeatureFlagReader(createFeatureFlagReader(config));
        setFeatureFlagLoading(false);
      },
      () => {
        if (cancelled) {
          return;
        }

        const emptyConfig = { features: {} };

        setBootstrapConfig(emptyConfig);
        setFeatureFlagReader(createFeatureFlagReader(emptyConfig));
        setFeatureFlagLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  return (
    <RootLayout
      services={services}
      apiBaseUrl={apiBaseUrl}
      bootstrapConfig={bootstrapConfig}
      featureFlagReader={featureFlagReader}
      featureFlagLoading={featureFlagLoading}
    />
  );
}
