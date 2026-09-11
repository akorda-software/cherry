import { describe, expect, it } from "vitest";

import type { BootstrapConfig } from "@snack/contracts";
import { createFeatureFlagReader } from "./feature-flags";

describe("createFeatureFlagReader", () => {
  it("reads a feature flag enabled from the bootstrap response", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        darkMode: { enabled: true }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("darkMode")).toBe(true);
  });

  it("returns false when the flag is disabled", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        darkMode: { enabled: false }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("darkMode")).toBe(false);
  });

  it("returns false for a flag that does not exist in the bootstrap response", () => {
    const bootstrap: BootstrapConfig = {
      features: {}
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("darkMode")).toBe(false);
  });

  it("returns false for any unknown flag key", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        darkMode: { enabled: true }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("nonexistent")).toBe(false);
  });

  it("reads multiple flags independently from the same bootstrap", () => {
    const bootstrap: BootstrapConfig = {
      features: {
        darkMode: { enabled: true },
        betaFeature: { enabled: false }
      }
    };

    const reader = createFeatureFlagReader(bootstrap);
    expect(reader.isEnabled("darkMode")).toBe(true);
    expect(reader.isEnabled("betaFeature")).toBe(false);
  });
});
