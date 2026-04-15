import { renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import type { FeatureFlagReader } from "@snack/mobile-shared";
import { RuntimeConfigProvider, useFeatureFlag, useRuntimeConfig } from "../config";

function createReader(flags: Record<string, boolean>): FeatureFlagReader {
  return {
    isEnabled(flagKey: string): boolean {
      return flags[flagKey] ?? false;
    }
  };
}

describe("useFeatureFlag", () => {
  it("returns enabled: true when the reader reports the flag as enabled", () => {
    const reader = createReader({ subscriptions: true });

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

    const { result } = renderHook(() => useFeatureFlag("subscriptions"), { wrapper });

    expect(result.current).toEqual({ enabled: true, loading: false });
  });

  it("returns enabled: false when the reader reports the flag as disabled", () => {
    const reader = createReader({ subscriptions: false });

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

    const { result } = renderHook(() => useFeatureFlag("subscriptions"), { wrapper });

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

    const { result } = renderHook(() => useFeatureFlag("subscriptions"), { wrapper });

    expect(result.current).toEqual({ enabled: false, loading: true });
  });

  it("returns enabled: false for unknown flag keys", () => {
    const reader = createReader({ subscriptions: true });

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

  it("exposes stripe runtime config when present", () => {
    const reader = createReader({});

    const wrapper = ({ children }: PropsWithChildren) => (
      <RuntimeConfigProvider
        apiBaseUrl="http://localhost:4000"
        bootstrapConfig={{
          features: {},
          services: {
            stripe: {
              publishableKey: "pk_test_123",
              merchantDisplayName: "Snack",
              merchantIdentifier: "merchant.snack",
              urlScheme: "snack"
            }
          }
        }}
        reader={reader}
        loading={false}
      >
        {children}
      </RuntimeConfigProvider>
    );

    const { result } = renderHook(() => useRuntimeConfig(), { wrapper });

    expect(result.current.bootstrapConfig?.services?.stripe?.publishableKey).toBe("pk_test_123");
  });
});
