import { describe, expect, it } from "vitest";

import { contractsPackageName } from "@cherry/contracts";
import { mobileSharedPackageName } from "@cherry/mobile-shared";
import { mobileFeatureLayers, mobileSharedLayers } from "../src/foundation";

describe("mobile test foundation", () => {
  it("resolves workspace packages and boundary metadata", () => {
    expect(contractsPackageName).toBe("@cherry/contracts");
    expect(mobileSharedPackageName).toBe("@cherry/mobile-shared");
    expect(mobileFeatureLayers).toEqual([
      "presentation",
      "application",
      "domain",
      "infrastructure"
    ]);
    expect(mobileSharedLayers).toEqual([
      "api",
      "config",
      "storage",
      "ui",
      "device"
    ]);
  });
});
