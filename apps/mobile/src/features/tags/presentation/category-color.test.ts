import { describe, expect, it } from "vitest";

import { TAG_CATEGORIES } from "@cherry/contracts";

import { lightTheme } from "../../../shared/ui/themes/light-theme";
import { categoryPastel } from "./category-color";

describe("categoryPastel", () => {
  it("gives every catalog category its own pastel", () => {
    const pastels = TAG_CATEGORIES.map((category) => categoryPastel(lightTheme, category));
    expect(pastels.every(Boolean)).toBe(true);
    expect(new Set(pastels).size).toBe(TAG_CATEGORIES.length);
    expect(categoryPastel(lightTheme, "interests")).toBe("cielo");
  });

  it("returns undefined for unknown categories", () => {
    expect(categoryPastel(lightTheme, "future_category")).toBeUndefined();
  });
});
