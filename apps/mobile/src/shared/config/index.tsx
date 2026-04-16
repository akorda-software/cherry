import { createContext, type PropsWithChildren, useContext, useMemo } from "react";

import type { BootstrapConfig } from "@snack/contracts";
import type { FeatureFlagReader } from "@snack/mobile-shared";

interface RuntimeConfigContextValue {
  apiBaseUrl: string;
  bootstrapConfig: BootstrapConfig | null;
  reader: FeatureFlagReader | null;
  loading: boolean;
}

const RuntimeConfigContext = createContext<RuntimeConfigContextValue>({
  apiBaseUrl: "",
  bootstrapConfig: null,
  reader: null,
  loading: true
});

export function RuntimeConfigProvider({
  children,
  apiBaseUrl,
  bootstrapConfig,
  reader,
  loading
}: PropsWithChildren<{
  apiBaseUrl: string;
  bootstrapConfig: BootstrapConfig | null;
  reader: FeatureFlagReader | null;
  loading: boolean;
}>) {
  const value = useMemo(
    () => ({
      apiBaseUrl,
      bootstrapConfig,
      reader,
      loading
    }),
    [apiBaseUrl, bootstrapConfig, loading, reader]
  );

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig() {
  return useContext(RuntimeConfigContext);
}

export function useFeatureFlag(flagKey: string): { enabled: boolean; loading: boolean } {
  const { reader, loading } = useRuntimeConfig();

  if (loading || reader === null) {
    return { enabled: false, loading: true };
  }

  return { enabled: reader.isEnabled(flagKey), loading: false };
}
