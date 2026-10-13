import { describe, expect, it } from "vitest";

import type { DiscoveryProfileCard } from "@cherry/contracts";

import {
  classifyDeckOrderChange,
  deckPosition,
  decideSwipe,
  nextResidual,
  restingTilt,
  swipeProgress,
  swipeThreshold
} from "./deck-order";
import { mergeLeavingPosts } from "./feed-leaving";

describe("deck order", () => {
  it("classifies pops, pushes, no-ops and resets", () => {
    expect(classifyDeckOrderChange(["a", "b", "c"], ["b", "c", "d"])).toBe("pop");
    expect(classifyDeckOrderChange(["b", "c"], ["a", "b", "c"])).toBe("push");
    expect(classifyDeckOrderChange(["a", "b"], ["a", "b", "c"])).toBe("same");
    expect(classifyDeckOrderChange(["a", "b"], ["x", "y"])).toBe("reset");
    expect(classifyDeckOrderChange([], ["x"])).toBe("reset");
  });

  it("keeps every card where it was drawn when the top card leaves mid-drag", () => {
    const progress = 0.6;
    const residual = 0;
    // Before: card at index 1 drawn at 1 + 0 - 0.6 = 0.4; index 2 at 1.4.
    const before = [deckPosition(1, residual, progress), deckPosition(2, residual, progress)];
    const after = nextResidual("pop", residual, progress);
    // After: they are index 0 and 1 with progress 0.
    expect([deckPosition(0, after, 0), deckPosition(1, after, 0)]).toEqual(before);
  });

  it("keeps positions continuous when a card comes back on top", () => {
    const residual = 0;
    const before = [deckPosition(0, residual, 0), deckPosition(1, residual, 0)];
    const after = nextResidual("push", residual, 0);

    expect([deckPosition(1, after, 0), deckPosition(2, after, 0)]).toEqual(before);
    expect(deckPosition(0, after, 0)).toBe(0);
  });
});

describe("swipe decisions", () => {
  const width = 390;

  it("uses ~28% of the width as distance threshold", () => {
    expect(swipeThreshold(width)).toBeCloseTo(109.2);
    expect(swipeProgress(54.6, width)).toBeCloseTo(0.5);
    expect(swipeProgress(-500, width)).toBe(1);
  });

  it("likes or passes past the threshold", () => {
    expect(decideSwipe({ translationX: 120, translationY: 10, velocityX: 0, velocityY: 0, width })).toBe("like");
    expect(decideSwipe({ translationX: -130, translationY: -20, velocityX: 0, velocityY: 0, width })).toBe("dislike");
  });

  it("accepts a quick flick even when short", () => {
    expect(decideSwipe({ translationX: 40, translationY: 0, velocityX: 1200, velocityY: 0, width })).toBe("like");
    expect(decideSwipe({ translationX: 10, translationY: 0, velocityX: 1200, velocityY: 0, width })).toBe("cancel");
  });

  it("does not decide against the direction of the flick", () => {
    expect(decideSwipe({ translationX: 60, translationY: 0, velocityX: -1500, velocityY: 0, width })).toBe("cancel");
  });

  it("opens the full profile with an upward drag or flick", () => {
    expect(decideSwipe({ translationX: 5, translationY: -130, velocityX: 0, velocityY: 0, width })).toBe("open");
    expect(decideSwipe({ translationX: 0, translationY: -40, velocityX: 0, velocityY: -1400, width })).toBe("open");
    expect(decideSwipe({ translationX: 0, translationY: 140, velocityX: 0, velocityY: 0, width })).toBe("cancel");
  });

  it("springs back when undecided", () => {
    expect(decideSwipe({ translationX: 60, translationY: 5, velocityX: 100, velocityY: 0, width })).toBe("cancel");
  });

  it("gives each photo a small, stable resting tilt", () => {
    expect(restingTilt("abc")).toBe(restingTilt("abc"));
    expect(Math.abs(restingTilt("xyz"))).toBeLessThanOrEqual(2.7);
  });
});

describe("feed leaving posts", () => {
  const card = (id: string) => ({ id }) as DiscoveryProfileCard;

  it("keeps a leaving post in its place until its farewell ends", () => {
    const rows = mergeLeavingPosts([card("a"), card("c")], [{ card: card("b"), index: 1, action: "like" }]);

    expect(rows.map((row) => row.card.id)).toEqual(["a", "b", "c"]);
    expect(rows[1]?.leaving?.action).toBe("like");
  });

  it("stops the farewell when the post comes back to the queue", () => {
    const rows = mergeLeavingPosts([card("a"), card("b")], [{ card: card("b"), index: 1, action: "like" }]);

    expect(rows.map((row) => [row.card.id, row.leaving])).toEqual([
      ["a", null],
      ["b", null]
    ]);
  });

  it("clamps indexes past the end", () => {
    const rows = mergeLeavingPosts([], [{ card: card("z"), index: 9, action: "dislike" }]);

    expect(rows.map((row) => row.card.id)).toEqual(["z"]);
  });
});
