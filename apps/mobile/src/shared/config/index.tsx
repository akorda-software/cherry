import { type PropsWithChildren, useEffect } from "react";

import { useRuntimeConfigStore } from "./runtime-config-store";

export { useRuntimeConfig, useFeatureFlag } from "./runtime-config-store";

export function RuntimeConfigProvider({
  children,
  apiBaseUrl,
  bootstrapConfig,
  reader,
  loading
}: PropsWithChildren<{
  apiBaseUrl: string;
  bootstrapConfig: ReturnType<typeof useRuntimeConfigStore.getState>["bootstrapConfig"];
  reader: ReturnType<typeof useRuntimeConfigStore.getState>["reader"];
  loading: boolean;
}>) {
  useEffect(() => {
    useRuntimeConfigStore.getState().setRuntimeConfig({ apiBaseUrl });
  }, [apiBaseUrl]);

  useEffect(() => {
    useRuntimeConfigStore.getState().setRuntimeConfig({ bootstrapConfig });
  }, [bootstrapConfig]);

  useEffect(() => {
    useRuntimeConfigStore.getState().setRuntimeConfig({ reader });
  }, [reader]);

  useEffect(() => {
    useRuntimeConfigStore.getState().setRuntimeConfig({ loading });
  }, [loading]);

  return <>{children}</>;
}
