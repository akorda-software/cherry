import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { FeatureFlagReader } from "@cherry/mobile-shared";
import {
  DEFAULT_MINIMUM_AGE,
  RuntimeConfigProvider,
  useFeatureFlag,
  useInstanceInfo,
  useMinimumAge,
  useRuntimeConfig
} from "../config";
import { useRuntimeConfigStore } from "./runtime-config-store";

function createReader(flags: Record<string, boolean>): FeatureFlagReader {
  return {
    isEnabled(flagKey: string): boolean {
      return flags[flagKey] ?? false;
    }
  };
}

describe("useFeatureFlag", () => {
  it("returns enabled: true when the reader reports the flag as enabled", () => {
    const reader = createReader({ darkMode: true });

    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://localhost:4000"
        bootstrapConfig={{ features: {} }}
        reader={reader}
        loading={false}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useFeatureFlag("darkMode"), { wrapper });

    expect(result.current).toEqual({ enabled: true, loading: false });
  });

  it("returns enabled: false when the reader reports the flag as disabled", () => {
    const reader = createReader({ darkMode: false });

    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://localhost:4000"
        bootstrapConfig={{ features: {} }}
        reader={reader}
        loading={false}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useFeatureFlag("darkMode"), { wrapper });

    expect(result.current).toEqual({ enabled: false, loading: false });
  });

  it("returns enabled: false, loading: true when reader is null (bootstrap not loaded)", () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://localhost:4000"
        bootstrapConfig={null}
        reader={null}
        loading={true}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useFeatureFlag("darkMode"), { wrapper });

    expect(result.current).toEqual({ enabled: false, loading: true });
  });

  it("returns enabled: false for unknown flag keys", () => {
    const reader = createReader({ darkMode: true });

    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://localhost:4000"
        bootstrapConfig={{ features: {} }}
        reader={reader}
        loading={false}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useFeatureFlag("nonexistent"), { wrapper });

    expect(result.current).toEqual({ enabled: false, loading: false });
  });

  it("exposes the resolved API base URL through runtime config", () => {
    const reader = createReader({});

    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://10.0.2.2:4000"
        bootstrapConfig={{ features: {} }}
        reader={reader}
        loading={false}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    expect(result.current.apiBaseUrl).toBe("http://10.0.2.2:4000");
  });

});

describe("useInstanceInfo y useMinimumAge", () => {
  const instance = {
    name: "Cherry France",
    country: "FR",
    locale: "fr-FR",
    operator: "Association Cherry FR",
    contactEmail: "contact@cherry.example",
    privacyUrl: null,
    termsUrl: null,
    sourceUrl: null
  };

  afterEach(() => {
    useRuntimeConfigStore.getState().setRuntimeConfig({ bootstrapConfig: null });
  });

  it("read the instance and its minimum age from GET /api/config", () => {
    useRuntimeConfigStore
      .getState()
      .setRuntimeConfig({ bootstrapConfig: { features: {}, instance, ageVerification: { minimumAge: 21 } } });

    expect(renderHook(() => useInstanceInfo()).result.current).toEqual(instance);
    expect(renderHook(() => useMinimumAge()).result.current).toBe(21);
  });

  it("fall back to no instance and 18 with older servers or while loading", () => {
    expect(renderHook(() => useInstanceInfo()).result.current).toBeNull();
    expect(renderHook(() => useMinimumAge()).result.current).toBe(DEFAULT_MINIMUM_AGE);

    useRuntimeConfigStore
      .getState()
      .setRuntimeConfig({ bootstrapConfig: { features: {}, ageVerification: { minimumAge: 12 } } });
    expect(renderHook(() => useMinimumAge()).result.current).toBe(18);
  });
});
