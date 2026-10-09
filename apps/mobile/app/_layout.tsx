import type { PropsWithChildren } from "react";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { Slot } from "expo-router";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { BootstrapConfig } from "@snack/contracts";
import { createConfigApi, createFeatureFlagReader, type FeatureFlagReader } from "@snack/mobile-shared";

import {
  AppBootstrapProvider,
  createBackendAppBootstrapService,
  createMockAppBootstrapService,
  type AppBootstrapService
} from "../src/features/app-bootstrap";
import { SessionShellProvider, type SessionShellServices } from "../src/features/auth/presentation";
import { createJsonHttpClient } from "../src/shared/api";
import { RuntimeConfigProvider } from "../src/shared/config";
import { fontFamilies, lightTheme, ThemeProvider, ToastHost } from "../src/shared/ui";

// El splash nativo se queda hasta que las fuentes de la libreta estén listas.
SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 220, fade: true });

/** Fuentes con los nombres EXACTOS de `theme.primitives.fonts` (cada peso es una familia). */
function fontAssets() {
  return {
    [fontFamilies.regular]: require("../assets/fonts/Rubik-Regular.ttf"),
    [fontFamilies.medium]: require("../assets/fonts/Rubik-Medium.ttf"),
    [fontFamilies.bold]: require("../assets/fonts/Rubik-Bold.ttf"),
    [fontFamilies.extraBold]: require("../assets/fonts/Rubik-ExtraBold.ttf"),
    [fontFamilies.black]: require("../assets/fonts/Rubik-Black.ttf")
  };
}

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
  appBootstrapService,
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
  appBootstrapService?: AppBootstrapService;
}>) {
  const resolvedAppBootstrapService = useMemo(
    () => appBootstrapService ?? createBackendAppBootstrapService(apiBaseUrl),
    [apiBaseUrl, appBootstrapService]
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <StatusBar style="dark" />
            <RuntimeConfigProvider
              apiBaseUrl={apiBaseUrl}
              bootstrapConfig={bootstrapConfig}
              reader={featureFlagReader}
              loading={featureFlagLoading}
            >
              <SessionShellProvider services={services}>
                <AppBootstrapProvider service={resolvedAppBootstrapService}>
                  {children ?? <Slot />}
                  <ToastHost />
                </AppBootstrapProvider>
              </SessionShellProvider>
            </RuntimeConfigProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: lightTheme.semantic.color.screenBackground
  }
});

export default function RootLayoutRoute() {
  const [fontsLoaded, fontError] = useFonts(fontAssets());
  const fontsReady = fontsLoaded || fontError !== null;
  const apiBaseUrl = useMemo(() => resolveApiBaseUrl(), []);
  const [services, setServices] = useState<SessionShellServices | undefined>(undefined);
  const [appBootstrapService, setAppBootstrapService] = useState<AppBootstrapService | undefined>(
    undefined
  );
  const [bootstrapConfig, setBootstrapConfig] = useState<BootstrapConfig | null>(null);
  const [featureFlagReader, setFeatureFlagReader] = useState<FeatureFlagReader | null>(null);
  const [featureFlagLoading, setFeatureFlagLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const httpClient = createJsonHttpClient({ apiBaseUrl });

    if (process.env.EXPO_PUBLIC_MOCK_AUTH === "true") {
      const { createMockAuthServices } = require("../src/features/auth/infrastructure/mock-auth-services");
      setServices(createMockAuthServices());
      setAppBootstrapService(createMockAppBootstrapService());
      return () => {
        cancelled = true;
      };
    }

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
        setAppBootstrapService(createBackendAppBootstrapService(apiBaseUrl));
      },
      () => {
        if (cancelled) {
          return;
        }

        setServices(undefined);
        setAppBootstrapService(undefined);
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

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(lightTheme.semantic.color.screenBackground).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <RootLayout
      services={services}
      appBootstrapService={appBootstrapService}
      apiBaseUrl={apiBaseUrl}
      bootstrapConfig={bootstrapConfig}
      featureFlagReader={featureFlagReader}
      featureFlagLoading={featureFlagLoading}
    />
  );
}
