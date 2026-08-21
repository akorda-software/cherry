import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { BootstrapConfig } from "@snack/contracts";
import type { FeatureFlagReader } from "@snack/mobile-shared";

interface RuntimeConfigState {
  apiBaseUrl: string;
  bootstrapConfig: BootstrapConfig | null;
  reader: FeatureFlagReader | null;
  loading: boolean;
  setRuntimeConfig(config: Partial<Omit<RuntimeConfigState, "setRuntimeConfig">>): void;
}

export type RuntimeConfigValue = Omit<RuntimeConfigState, "setRuntimeConfig">;

export const useRuntimeConfigStore = create<RuntimeConfigState>((set) => ({
  apiBaseUrl: "",
  bootstrapConfig: null,
  reader: null,
  loading: true,
  setRuntimeConfig: (config) => set(config)
}));

export function useRuntimeConfig(): RuntimeConfigValue {
  return useRuntimeConfigStore(
    useShallow(({ apiBaseUrl, bootstrapConfig, reader, loading }) => ({
      apiBaseUrl,
      bootstrapConfig,
      reader,
      loading
    }))
  );
}

export function useFeatureFlag(flagKey: string): { enabled: boolean; loading: boolean } {
  const reader = useRuntimeConfigStore((s) => s.reader);
  const loading = useRuntimeConfigStore((s) => s.loading);

  if (loading || reader === null) {
    return { enabled: false, loading: true };
  }

  return { enabled: reader.isEnabled(flagKey), loading: false };
}
