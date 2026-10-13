import { describe, expect, it } from "vitest";

import { makeTag } from "../../onboarding/testing/fixtures";
import { groupTagsByCategory, normalizeSearchText, searchTags, tagCategoryLabel, tagsByIds } from "./tag-catalog";

const catalog = [
  makeTag(3, { category: "pets", label: "Amante de perros", slug: "dogs" }),
  makeTag(1, { category: "interests", label: "Música", slug: "music" }),
  makeTag(2, { category: "interests", label: "Cine y series", slug: "cinema" }),
  makeTag(4, { category: "future_category", label: "Algo nuevo", slug: "new_thing" }),
  makeTag(5, { category: "relationship", label: "Quiero tener hijos", slug: "wants_kids" })
];

describe("groupTagsByCategory", () => {
  it("orders sections like the catalog and unknown categories last", () => {
    const sections = groupTagsByCategory(catalog);
    expect(sections.map((section) => section.category)).toEqual(["interests", "pets", "relationship", "future_category"]);
    expect(sections[0].label).toBe("Intereses");
    expect(sections[0].tags.map((tag) => tag.label)).toEqual(["Música", "Cine y series"]);
    expect(sections[3].label).toBe("future_category");
  });
});

describe("searchTags", () => {
  it("ignores accents and case", () => {
    expect(searchTags(catalog, "MUSICA").map((tag) => tag.slug)).toEqual(["music"]);
    expect(normalizeSearchText("  Relación  y familia ")).toBe("relacion y familia");
  });

  it("matches by slug words and category name", () => {
    expect(searchTags(catalog, "kids").map((tag) => tag.slug)).toEqual(["wants_kids"]);
    expect(searchTags(catalog, "mascotas").map((tag) => tag.slug)).toEqual(["dogs"]);
  });

  it("needs every word to match and returns everything for an empty query", () => {
    expect(searchTags(catalog, "cine series").map((tag) => tag.slug)).toEqual(["cinema"]);
    expect(searchTags(catalog, "cine perros")).toEqual([]);
    expect(searchTags(catalog, "  ")).toHaveLength(catalog.length);
  });
});

describe("tagsByIds", () => {
  it("keeps the order of the ids and skips unknown ones", () => {
    expect(tagsByIds(catalog, ["tag-5", "ghost", "tag-1"]).map((tag) => tag.id)).toEqual(["tag-5", "tag-1"]);
  });

  it("labels categories", () => {
    expect(tagCategoryLabel("relationship")).toBe("Relación y familia");
  });
});
