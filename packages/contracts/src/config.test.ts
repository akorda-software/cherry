import { describe, expect, it } from "vitest";

import { createBootstrapConfig } from "./config";

describe("createBootstrapConfig", () => {
  it("builds the bootstrap config map for runtime feature flags", () => {
    expect(
      createBootstrapConfig({
        features: {
          beta: { enabled: false },
          darkMode: { enabled: true }
        }
      })
    ).toEqual({
      features: {
        beta: { enabled: false },
        darkMode: { enabled: true }
      }
    });
  });
});

describe("createBootstrapConfig with instance data", () => {
  it("keeps the instance identity and the minimum age when the server sends them", () => {
    const instance = {
      name: "Cherry France",
      country: "FR",
      locale: "fr-FR",
      operator: "Association Cherry FR",
      contactEmail: "contact@cherry.example",
      privacyUrl: "https://cherry.example/confidentialite",
      termsUrl: null,
      sourceUrl: null
    };

    expect(createBootstrapConfig({ features: {}, instance, ageVerification: { minimumAge: 18 } })).toEqual({
      features: {},
      instance,
      ageVerification: { minimumAge: 18 }
    });
    expect(createBootstrapConfig({ features: {} })).toEqual({ features: {} });
  });
});
