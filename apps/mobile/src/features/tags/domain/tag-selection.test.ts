import { describe, expect, it } from "vitest";

import {
  EMPTY_TAG_SELECTION,
  pressTagControl,
  sameTagSelection,
  tagStateOf,
  toggleTag,
  withoutTagIds,
  type TagSelection
} from "./tag-selection";

const ids = (count: number, prefix = "t") => Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`);

describe("toggleTag — positive", () => {
  it("adds and removes a tag", () => {
    const added = toggleTag(EMPTY_TAG_SELECTION, "positive", "t1");
    expect(added.outcome).toEqual({ type: "added" });
    expect(added.selection.positive).toEqual(["t1"]);

    const removed = toggleTag(added.selection, "positive", "t1");
    expect(removed.outcome).toEqual({ type: "removed" });
    expect(removed.selection.positive).toEqual([]);
  });

  it("keeps the selection order (the shelf shows them in the order they were picked)", () => {
    let selection = EMPTY_TAG_SELECTION;
    for (const id of ["c", "a", "b"]) selection = toggleTag(selection, "positive", id).selection;
    expect(selection.positive).toEqual(["c", "a", "b"]);
  });

  it("stops at 8 and reports the limit without changing anything", () => {
    const full: TagSelection = { positive: ids(8), blocked: [] };
    const result = toggleTag(full, "positive", "t9");
    expect(result.outcome).toEqual({ type: "limit_reached", limit: 8 });
    expect(result.selection).toBe(full);
  });

  it("still lets you remove a tag when the list is full", () => {
    const full: TagSelection = { positive: ids(8), blocked: [] };
    expect(toggleTag(full, "positive", "t3").selection.positive).toHaveLength(7);
  });

  it("moves a blocked tag to your tags by default (choosing it un-blocks it)", () => {
    const result = toggleTag({ positive: [], blocked: ["t1", "t2"] }, "positive", "t1");
    expect(result.outcome).toEqual({ type: "moved" });
    expect(result.selection).toEqual({ positive: ["t1"], blocked: ["t2"] });
  });

  it("can reject that move instead", () => {
    const selection = { positive: [], blocked: ["t1"] };
    const result = toggleTag(selection, "positive", "t1", { onConflict: "reject" });
    expect(result.outcome).toEqual({ type: "conflict" });
    expect(result.selection).toBe(selection);
  });

  it("does not move a blocked tag into a full positive list", () => {
    const selection = { positive: ids(8), blocked: ["x"] };
    const result = toggleTag(selection, "positive", "x");
    expect(result.outcome.type).toBe("limit_reached");
    expect(result.selection).toBe(selection);
  });
});

describe("toggleTag — blocked", () => {
  it("adds up to 5", () => {
    let selection = EMPTY_TAG_SELECTION;
    for (const id of ids(5, "b")) selection = toggleTag(selection, "blocked", id).selection;
    expect(selection.blocked).toHaveLength(5);
    expect(toggleTag(selection, "blocked", "b6").outcome).toEqual({ type: "limit_reached", limit: 5 });
  });

  it("refuses by default to block one of your own tags", () => {
    const selection = { positive: ["t1"], blocked: [] };
    const result = toggleTag(selection, "blocked", "t1");
    expect(result.outcome).toEqual({ type: "conflict" });
    expect(result.selection).toBe(selection);
  });

  it("reports the conflict before the limit (the reason that matters)", () => {
    const selection = { positive: ["t1"], blocked: ids(5, "b") };
    expect(toggleTag(selection, "blocked", "t1").outcome).toEqual({ type: "conflict" });
  });

  it("honours custom limits", () => {
    const limits = { maxPositive: 2, maxBlocked: 1 };
    let selection = EMPTY_TAG_SELECTION;
    selection = toggleTag(selection, "blocked", "b1", { limits }).selection;
    expect(toggleTag(selection, "blocked", "b2", { limits }).outcome.type).toBe("limit_reached");
  });
});

describe("pressTagControl — one page with + and − per tag", () => {
  it("+ on a neutral tag likes it; + again brings it back to neutral", () => {
    const liked = pressTagControl(EMPTY_TAG_SELECTION, "positive", "t1");
    expect(liked.outcome).toEqual({ type: "added" });
    expect(tagStateOf(liked.selection, "t1")).toBe("liked");

    const neutral = pressTagControl(liked.selection, "positive", "t1");
    expect(neutral.outcome).toEqual({ type: "removed" });
    expect(tagStateOf(neutral.selection, "t1")).toBe("neutral");
  });

  it("− on a neutral tag blocks it; − again brings it back to neutral", () => {
    const blocked = pressTagControl(EMPTY_TAG_SELECTION, "blocked", "t1");
    expect(blocked.outcome).toEqual({ type: "added" });
    expect(tagStateOf(blocked.selection, "t1")).toBe("blocked");
    expect(tagStateOf(pressTagControl(blocked.selection, "blocked", "t1").selection, "t1")).toBe("neutral");
  });

  it("the other control switches the tag between lists", () => {
    const liked = pressTagControl(EMPTY_TAG_SELECTION, "positive", "t1").selection;
    const blocked = pressTagControl(liked, "blocked", "t1");
    expect(blocked.outcome).toEqual({ type: "moved" });
    expect(blocked.selection).toEqual({ positive: [], blocked: ["t1"] });

    const likedAgain = pressTagControl(blocked.selection, "positive", "t1");
    expect(likedAgain.outcome).toEqual({ type: "moved" });
    expect(likedAgain.selection).toEqual({ positive: ["t1"], blocked: [] });
  });

  it("keeps the limits: 8 liked, 5 blocked, also when switching", () => {
    const full: TagSelection = { positive: ids(8), blocked: ids(5, "b") };
    expect(pressTagControl(full, "positive", "x").outcome).toEqual({ type: "limit_reached", limit: 8 });
    expect(pressTagControl(full, "blocked", "x").outcome).toEqual({ type: "limit_reached", limit: 5 });

    // Pasar una de «me gusta» a bloqueada con las bloqueadas llenas no toca nada.
    const result = pressTagControl(full, "blocked", "t1");
    expect(result.outcome).toEqual({ type: "limit_reached", limit: 5 });
    expect(result.selection).toBe(full);
    expect(tagStateOf(result.selection, "t1")).toBe("liked");
  });

  it("never leaves a tag in both lists, whatever the sequence of taps", () => {
    const universe = ids(12);
    let selection = EMPTY_TAG_SELECTION;
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let tap = 0; tap < 2000; tap += 1) {
      const tagId = universe[Math.floor(random() * universe.length)];
      const kind = random() < 0.5 ? "positive" : "blocked";
      selection = pressTagControl(selection, kind, tagId).selection;

      const blocked = new Set(selection.blocked);
      expect(selection.positive.some((id) => blocked.has(id))).toBe(false);
      expect(new Set(selection.positive).size).toBe(selection.positive.length);
      expect(new Set(selection.blocked).size).toBe(selection.blocked.length);
      expect(selection.positive.length).toBeLessThanOrEqual(8);
      expect(selection.blocked.length).toBeLessThanOrEqual(5);
    }
  });
});

describe("helpers", () => {
  it("reads the state of a tag", () => {
    const selection = { positive: ["a"], blocked: ["b"] };
    expect(tagStateOf(selection, "a")).toBe("liked");
    expect(tagStateOf(selection, "b")).toBe("blocked");
    expect(tagStateOf(selection, "c")).toBe("neutral");
  });

  it("drops ids from both lists", () => {
    expect(withoutTagIds({ positive: ["a", "b"], blocked: ["c"] }, ["b", "c"])).toEqual({ positive: ["a"], blocked: [] });
  });

  it("compares selections ignoring order", () => {
    expect(sameTagSelection({ positive: ["a", "b"], blocked: [] }, { positive: ["b", "a"], blocked: [] })).toBe(true);
    expect(sameTagSelection({ positive: ["a"], blocked: [] }, { positive: ["a"], blocked: ["x"] })).toBe(false);
  });
});
