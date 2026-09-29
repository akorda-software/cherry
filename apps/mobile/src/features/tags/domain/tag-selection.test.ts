import { describe, expect, it } from "vitest";

import {
  EMPTY_TAG_SELECTION,
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
