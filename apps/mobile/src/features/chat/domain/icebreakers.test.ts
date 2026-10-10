import { describe, expect, it } from "vitest";

import type { ProfileTag } from "@cherry/contracts";

import { buildIcebreakers, icebreakerContext, icebreakerPromptForTag } from "./icebreakers";

function tag(slug: string, shared: boolean, label = slug, emoji: string | null = "✨"): ProfileTag {
  return { id: `id-${slug}`, slug, label, emoji, category: "interests", shared };
}

describe("buildIcebreakers", () => {
  it("builds suggestions from shared tags only", () => {
    const suggestions = buildIcebreakers([
      tag("coffee", true, "Amante del café", "☕"),
      tag("hiking", false),
      tag("reading", true, "Lectura", "📚")
    ]);

    expect(suggestions.map((s) => s.id)).toEqual(expect.arrayContaining(["tag-coffee", "tag-reading"]));
    expect(suggestions.every((s) => s.tag === null || ["coffee", "reading"].includes(s.tag.slug))).toBe(true);
    expect(suggestions.find((s) => s.id === "tag-coffee")?.message).toBe("¿Cuál es tu cafetería favorita?");
  });

  it("never uses delicate tags as conversation openers", () => {
    const suggestions = buildIcebreakers(
      ["has_kids", "wants_kids", "childfree", "monogamous", "open_relationship", "smoker", "cannabis", "no_pets"].map(
        (slug) => tag(slug, true)
      )
    );

    expect(suggestions.every((s) => s.tag === null)).toBe(true);
  });

  it("caps at three and fills with generic ideas to at least two", () => {
    const many = ["music", "cinema", "reading", "travel", "coffee"].map((slug) => tag(slug, true));
    expect(buildIcebreakers(many)).toHaveLength(3);

    const one = buildIcebreakers([tag("coffee", true)]);
    expect(one).toHaveLength(2);
    expect(one.filter((s) => s.tag === null)).toHaveLength(1);

    const none = buildIcebreakers([]);
    expect(none).toHaveLength(2);
    expect(new Set(none.map((s) => s.message)).size).toBe(2);
  });

  it("is stable for the same seed and varies between conversations", () => {
    const tags = ["music", "cinema", "reading", "travel", "coffee"].map((slug) => tag(slug, true));
    const first = buildIcebreakers(tags, { seed: "conv-a" });
    expect(buildIcebreakers(tags, { seed: "conv-a" })).toEqual(first);

    const seeds = ["conv-b", "conv-c", "conv-d", "conv-e", "conv-f"];
    const variants = new Set(seeds.map((seed) => buildIcebreakers(tags, { seed })[0]!.id));
    expect(variants.size).toBeGreaterThan(1);
  });

  it("handles missing tags", () => {
    expect(buildIcebreakers(undefined)).toHaveLength(2);
    expect(buildIcebreakers(null, { max: 1, min: 1 })).toHaveLength(1);
  });
});

describe("icebreaker copy", () => {
  it("has a prompt for the friendly tags of the catalogue", () => {
    for (const slug of ["music", "coffee", "hiking", "dogs", "cats", "astrology", "board_games"]) {
      expect(icebreakerPromptForTag(slug)).toMatch(/\?|\.$/);
    }
    expect(icebreakerPromptForTag("smoker")).toBeNull();
  });

  it("describes the shared tag in the context line", () => {
    const [coffee] = buildIcebreakers([tag("coffee", true, "Amante del café", "☕")], { min: 1, max: 1 });
    expect(icebreakerContext(coffee!)).toBe("En común: ☕ Amante del café");
    expect(icebreakerContext({ id: "g", tag: null, message: "¿Qué tal?" })).toBe("Para empezar con buen pie");
  });
});
