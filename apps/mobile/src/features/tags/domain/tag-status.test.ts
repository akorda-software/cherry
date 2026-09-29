import { describe, expect, it } from "vitest";

import { blockedTagsStatus, positiveTagsStatus } from "./tag-status";

describe("shelf status texts", () => {
  it("guides towards 3 (minimum) and 5 (recommended) positive tags", () => {
    expect(positiveTagsStatus(0)).toBe("Elige al menos 3");
    expect(positiveTagsStatus(1)).toBe("Te faltan 2");
    expect(positiveTagsStatus(2)).toBe("Te falta 1");
    expect(positiveTagsStatus(3)).toMatch(/Con 5/);
    expect(positiveTagsStatus(4)).toMatch(/Con 5/);
    expect(positiveTagsStatus(5)).toMatch(/Genial/);
    expect(positiveTagsStatus(8)).toBe("¡Estante completo!");
  });

  it("keeps blocked tags optional", () => {
    expect(blockedTagsStatus(0)).toBe("Opcional · hasta 5");
    expect(blockedTagsStatus(2)).toBe("2 de 5 · nada de dramas");
    expect(blockedTagsStatus(5)).toBe("Has llegado al máximo");
  });
});
