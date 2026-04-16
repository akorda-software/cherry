import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { Slot } from "expo-router";
import Constants from "expo-constants";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { BootstrapConfig } from "@snack/contracts";
import { createConfigApi, createFeatureFlagReader, type FeatureFlagReader } from "@snack/mobile-shared";

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

function isExpoGo() {
  return Constants.executionEnvironment === "storeClient";
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
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RuntimeConfigProvider
          apiBaseUrl={apiBaseUrl}
          bootstrapConfig={bootstrapConfig}
          reader={featureFlagReader}
          loading={featureFlagLoading}
        >
          <SessionShellProvider services={services}>{children ?? <Slot />}</SessionShellProvider>
        </RuntimeConfigProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayoutRoute() {
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [services, setServices] = useState<SessionShellServices | undefined>(undefined);
  const [bootstrapConfig, setBootstrapConfig] = useState<BootstrapConfig | null>(null);
  const [featureFlagReader, setFeatureFlagReader] = useState<FeatureFlagReader | null>(null);
  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const httpClient = createJsonHttpClient({ apiBaseUrl });

    if (isExpoGo()) {
      setServices(undefined);
      return () => {
        cancelled = true;
      };
    }

    void import("../src/features/auth/infrastructure/native-auth-services").then(
      ({ createNativeAuthServices }) => {
        if (cancelled) {
          return;
        }

        setServices(
          createNativeAuthServices({
            apiBaseUrl,
            httpClient
          })
        );
      },
      () => {
        if (cancelled) {
          return;
        }

        setServices(undefined);
      }
    );

    return () => {
      cancelled = true;
    };
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
