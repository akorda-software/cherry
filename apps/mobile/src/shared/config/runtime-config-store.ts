import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { BootstrapConfig, InstanceInfo } from "@cherry/contracts";
import type { FeatureFlagReader } from "@cherry/mobile-shared";

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

/** Edad mínima si el servidor aún no la ha dicho (o es anterior a `ageVerification`). */
export const DEFAULT_MINIMUM_AGE = 18;

/** Quién gestiona la instancia (`GET /api/config`); `null` mientras carga o con servidores antiguos. */
export function useInstanceInfo(): InstanceInfo | null {
  return useRuntimeConfigStore((s) => s.bootstrapConfig?.instance ?? null);
}

/** Edad mínima de la instancia: la del servidor o, si no la envía, 18. */
export function useMinimumAge(): number {
  return useRuntimeConfigStore((s) => {
    const minimumAge = s.bootstrapConfig?.ageVerification?.minimumAge;
    return typeof minimumAge === "number" && Number.isInteger(minimumAge) && minimumAge >= DEFAULT_MINIMUM_AGE
      ? minimumAge
      : DEFAULT_MINIMUM_AGE;
  });
}
